import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDbTools } from "./tools/db.js";
import { registerModelTools } from "./tools/models.js";

const server = new McpServer({
  name: "the-culture-mcp",
  version: "1.0.0",
  description: "MCP server for The Culture app — Supabase DB tools and HF model inference tools",
});

registerDbTools(server);
registerModelTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[the-culture-mcp] server running");
