import express from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';

export function startInboundServer() {
  const app = express();
  
  // We need the raw body for signature verification if we were strictly enforcing it.
  // For simplicity, we use express.json() but a real production app might use a raw buffer.
  app.use(express.json());

  const PORT = process.env.PORT || 3000;

  app.post('/webhooks/inbound', async (req, res) => {
    try {
      // Typically, an inbound webhook should have a shared secret we can verify here.
      // E.g., const signature = req.headers['x-webhook-signature'];
      // if (signature !== computedSignature) return res.status(401).send('Unauthorized');
      
      const payload = req.body;
      
      // Basic example: handle a task status update
      if (payload.event === 'external.task_updated' && payload.data?.id) {
        const { error } = await supabase
          .from('todos')
          .update(payload.data)
          .eq('id', payload.data.id);
          
        if (error) {
          console.error("Failed to update todo from inbound webhook", error);
          return res.status(500).json({ error: 'Database update failed' });
        }
      } else if (payload.event === 'external.task_created') {
        const { error } = await supabase
          .from('todos')
          .insert([payload.data]);

        if (error) {
          console.error("Failed to insert todo from inbound webhook", error);
          return res.status(500).json({ error: 'Database insert failed' });
        }
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error processing inbound webhook", err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.listen(PORT, () => {
    console.error(`Inbound webhook server listening on port ${PORT}`);
  });
}
