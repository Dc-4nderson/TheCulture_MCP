import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { registerDbTools } from "./tools/db.js";
import { registerModelTools } from "./tools/models.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "the-culture-mcp",
    version: "1.0.0",
    description: "MCP server for The Culture app — Supabase DB tools and HF model inference tools",
  });

  registerDbTools(server);
  registerModelTools(server);

  return server;
}

const app = createMcpExpressApp({ host: "0.0.0.0" });

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("[the-culture-mcp] error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

app.delete("/mcp", (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.error(`[the-culture-mcp] streamable HTTP server listening on port ${PORT}`);
});
