import crypto from 'crypto';
import { supabase } from '../db/supabase.js';

export async function dispatchEvent(event: string, data: any, metadata?: any) {
  try {
    // Query active webhooks registered for this event
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('url, secret, events')
      .eq('is_active', true);

    if (error || !webhooks) {
      console.error('Failed to fetch webhooks:', error);
      return;
    }

    const targetWebhooks = webhooks.filter(wh => wh.events.includes(event));
    if (targetWebhooks.length === 0) return; // No registered webhooks for this event

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: metadata || {}
    };

    const body = JSON.stringify(payload);

    // Dispatch asynchronously without blocking
    for (const wh of targetWebhooks) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (wh.secret) {
        const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      fetch(wh.url, {
        method: 'POST',
        headers,
        body,
      }).then(response => {
        if (!response.ok) {
          console.error(`Webhook dispatch to ${wh.url} failed with status: ${response.status}`);
        }
      }).catch(fetchError => {
        console.error(`Error dispatching webhook to ${wh.url}:`, fetchError.message);
      });
    }
  } catch (err) {
    console.error('Error in webhook dispatcher engine:', err);
  }
}
