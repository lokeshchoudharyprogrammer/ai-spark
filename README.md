# Supabase To-Do MCP Server

A Model Context Protocol (MCP) server for a To-Do management system backed by Supabase. It features an outbound webhook dispatcher engine and an inbound webhook server.

## Features
- **To-Do Management:** Create, list, get, update, and delete tasks.
- **Dynamic Webhooks:** Register external webhooks dynamically in the database via MCP tools.
- **Outbound Webhooks:** Emits `todo.created`, `todo.updated`, and `todo.deleted` events with HMAC-SHA256 signatures.
- **Inbound Webhook Server:** An Express HTTP server listening on a configurable port to ingest events.

## Database Setup

Run the SQL migration script in your Supabase SQL Editor. See [schema.sql](./schema.sql).

*(Alternative: You can use Supabase's native `pg_net` extension for Database Webhooks directly from the Supabase dashboard -> Database -> Webhooks. The current implementation handles webhooks via the MCP server/Node to meet the requirements.)*

## Installation & Configuration

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill out your credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   PORT=3000
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## MCP Client Configuration (Claude Desktop / Cursor)

Add the following to your MCP client configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "todo-webhook-server": {
      "command": "node",
      "args": ["/absolute/path/to/crazy/dist/index.js"],
      "env": {
        "SUPABASE_URL": "YOUR_URL",
        "SUPABASE_ANON_KEY": "YOUR_KEY",
        "PORT": "3000"
      }
    }
  }
}
```

## Running standalone

```bash
npm start
```
