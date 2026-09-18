#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { startInboundServer } from "./server/inboundServer.js";
import { 
  todoToolsDefinition, 
  handleCreateTodo, 
  handleListTodos, 
  handleGetTodo, 
  handleUpdateTodo, 
  handleDeleteTodo 
} from "./tools/todoTools.js";
import {
  webhookToolsDefinition,
  handleCreateWebhook,
  handleListWebhooks,
  handleDeleteWebhook
} from "./tools/webhookTools.js";

const server = new Server(
  {
    name: "supabase-todo-webhook-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Start optional inbound webhook listener in background
startInboundServer();

// Register tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...todoToolsDefinition, ...webhookToolsDefinition],
  };
});

// Register tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_todo":
        return await handleCreateTodo(args);
      case "list_todos":
        return await handleListTodos(args);
      case "get_todo":
        return await handleGetTodo(args);
      case "update_todo":
        return await handleUpdateTodo(args);
      case "delete_todo":
        return await handleDeleteTodo(args);
        
      case "create_webhook":
        return await handleCreateWebhook(args);
      case "list_webhooks":
        return await handleListWebhooks(args);
      case "delete_webhook":
        return await handleDeleteWebhook(args);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Supabase Todo MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
