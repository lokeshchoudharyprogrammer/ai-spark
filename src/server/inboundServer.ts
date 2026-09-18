import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { supabase } from '../db/supabase.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export function startInboundServer(createServer: () => Server) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Enable CORS with credentials for Gemini
  app.use(cors({
    origin: function (origin, callback) {
      callback(null, origin || '*');
    },
    credentials: true
  }));

  const requestLogs: any[] = [];
  
  // Log all incoming requests to help debug Gemini
  app.use((req, res, next) => {
    const logEntry = {
      time: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers
    };
    requestLogs.push(logEntry);
    if (requestLogs.length > 50) requestLogs.shift();
    console.error(`[INCOMING] ${req.method} ${req.url}`);
    next();
  });

  app.get('/logs', (req, res) => {
    res.json(requestLogs);
  });

  // Simple health check endpoint for pings
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // --- MCP SSE Endpoints ---
  // Store active transports mapped by their sessionId
  const transports = new Map<string, SSEServerTransport>();

  app.get('/sse', async (req, res) => {
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const transport = new SSEServerTransport(`${host}/messages`, res);
    
    // Create a new MCP server instance dedicated to this client connection
    const mcpServer = createServer();
    await mcpServer.connect(transport);
    
    // Store the transport so we can route POST requests to it
    transports.set(transport.sessionId, transport);
    
    res.on('close', () => {
      console.error(`SSE connection closed: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    });
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    
    if (!transport) {
      res.status(404).json({ error: "Session not found or inactive" });
      return;
    }
    
    await transport.handlePostMessage(req, res);
  });
  // -------------------------

  // Apply express.json() ONLY to the webhook route where it's needed
  app.post('/webhooks/inbound', express.json(), async (req, res) => {
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
