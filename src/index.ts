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

export function createMcpServer() {
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

  return server;
}

// Start the express server and pass the factory so it can create a new server per SSE connection
startInboundServer(createMcpServer);

// If we are NOT running on Render, also attach stdio for local terminal usage
if (!process.env.RENDER) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error("Supabase Todo MCP server running on stdio");
  });
}
