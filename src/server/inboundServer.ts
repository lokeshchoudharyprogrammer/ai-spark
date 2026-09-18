import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { supabase } from '../db/supabase.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export function startInboundServer(createServer: () => any) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({
    origin: function (origin, callback) {
      callback(null, origin || '*');
    },
    credentials: true
  }));

  // Enable JSON parsing for ALL routes to support StreamableHTTP POST bodies
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.head('/sse', (req, res) => {
    res.status(200).end();
  });

  // Track active stateful transports by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const handleMcpRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = (req.query.sessionId || req.headers['mcp-session-id']) as string;
    
    let transport: StreamableHTTPServerTransport;
    
    // For new initialization requests
    if (!sessionId) {
      transport = new StreamableHTTPServerTransport();
      const mcpServer = createServer();
      await mcpServer.connect(transport);
      
      // We don't have the generated sessionId until after we start it, but transport.sessionId is available
      // Actually transport.sessionId is available after construction in stateful mode!
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
      }
    } else {
      // Find existing transport
      transport = transports.get(sessionId) as StreamableHTTPServerTransport;
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
    }

    // StreamableHTTPServerTransport handles both GET (SSE) and POST (Messages) natively
    await transport.handleRequest(req as any, res as any, req.body);
  };

  app.get('/sse', handleMcpRequest);
  app.post('/sse', handleMcpRequest);
  app.post('/messages', handleMcpRequest); // Keep this for Cursor if it falls back

  // Webhooks
  app.post('/webhooks/inbound', async (req, res) => {
    try {
      const payload = req.body;
      
      // Basic example: handle a task status update
      if (payload.event === 'external.task_updated' && payload.data?.id) {
        const { error } = await supabase
          .from('todos')
          .update(payload.data)
          .eq('id', payload.data.id);
          
        if (error) {
          console.error("Failed to update todo from inbound webhook", error);
          res.status(500).json({ error: 'Database update failed' });
          return;
        }
      } else if (payload.event === 'external.task_created') {
        const { error } = await supabase
          .from('todos')
          .insert([payload.data]);

        if (error) {
          console.error("Failed to insert todo from inbound webhook", error);
          res.status(500).json({ error: 'Database insert failed' });
          return;
        }
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error processing inbound webhook", err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.listen(PORT, () => {
    console.error(`Express server listening on port ${PORT}`);

    // Cron job: Self-ping every 3 minutes (180,000 ms) to keep the Render free tier awake
    setInterval(() => {
      const pingUrl = process.env.RENDER_EXTERNAL_URL 
        ? `${process.env.RENDER_EXTERNAL_URL}/health` 
        : `http://localhost:${PORT}/health`;
        
      fetch(pingUrl).catch(() => {});
    }, 3 * 60 * 1000); // 3 minutes
  });
}
