import express from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export function startInboundServer(mcpServer: Server) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Simple health check endpoint for pings
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // --- MCP SSE Endpoints ---
  // IMPORTANT: We do NOT use global express.json() because SSEServerTransport 
  // needs to read the raw request stream directly.
  let transport: SSEServerTransport | null = null;

  app.get('/sse', async (req, res) => {
    console.error("New SSE connection established");
    transport = new SSEServerTransport("/messages", res);
    await mcpServer.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: "No active SSE connection" });
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
      // Render automatically sets RENDER_EXTERNAL_URL in the environment
      const pingUrl = process.env.RENDER_EXTERNAL_URL 
        ? `${process.env.RENDER_EXTERNAL_URL}/health` 
        : `http://localhost:${PORT}/health`;
        
      fetch(pingUrl).catch(() => {
        // Silently catch errors so a failed ping doesn't crash the server
      });
    }, 3 * 60 * 1000); // 3 minutes
  });
}
