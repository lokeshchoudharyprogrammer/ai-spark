import crypto from 'crypto';
import { supabase } from "../db/supabase.js";

export const webhookToolsDefinition = [
  {
    name: "create_webhook",
    description: "Register a new webhook target",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Valid HTTPS URL" },
        secret: { type: "string", description: "Optional. Automatically generated if omitted" },
        events: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Array of events, e.g. ['todo.created', 'todo.updated', 'todo.deleted']"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "list_webhooks",
    description: "List all registered webhooks",
    inputSchema: {
      type: "object",
      properties: {
        include_inactive: { type: "boolean", description: "Default false" }
      }
    }
  },
  {
    name: "delete_webhook",
    description: "Delete a webhook entry",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID of the webhook" }
      },
      required: ["id"]
    }
  }
];

export async function handleCreateWebhook(args: any) {
  const { url, secret, events } = args;
  
  const finalSecret = secret || crypto.randomBytes(16).toString('hex');
  const finalEvents = events || ['todo.created', 'todo.updated', 'todo.deleted'];
  
  const { data, error } = await supabase
    .from('webhooks')
    .insert([{ url, secret: finalSecret, events: finalEvents }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }

  return {
    content: [{ type: "text", text: `Webhook registered successfully:\n${JSON.stringify(data, null, 2)}` }]
  };
}

export async function handleListWebhooks(args: any) {
  const { include_inactive = false } = args;

  let query = supabase.from('webhooks').select('*');

  if (!include_inactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

export async function handleDeleteWebhook(args: any) {
  const { id } = args;

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }

  return {
    content: [{ type: "text", text: `Webhook with ID ${id} deleted successfully.` }]
  };
}
