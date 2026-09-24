import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { verifyApiKey } from '../shared/services/auth';
import { connectDb } from './db';
import { registerTools } from './tools';

// This process only ever talks stdio JSON-RPC on stdout — never console.log
// anything here, or it corrupts the MCP protocol stream for the client.
const log = (...args: unknown[]) => console.error('[nodedr-mcp]', ...args);

const main = async () => {
  const apiKey = process.env.NODEDR_API_KEY;
  if (!apiKey) {
    log(
      'NODEDR_API_KEY is not set. Create one via POST /api/auth/api-keys (requires a logged-in session) and set it in this process env.'
    );
    process.exit(1);
  }

  const db = await connectDb();

  const verified = await verifyApiKey(db, apiKey);
  if (!verified) {
    log('NODEDR_API_KEY is invalid or has been revoked.');
    process.exit(1);
  }
  log(`Authenticated as API key "${verified.name}".`);

  const server = new McpServer({ name: 'nodedr-invoice', version: '1.0.0' });
  registerTools(server, db);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP server ready on stdio.');
};

main().catch(err => {
  log('Fatal error starting MCP server:', err);
  process.exit(1);
});
