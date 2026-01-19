#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Entry, findCredentials } from "@napi-rs/keyring";

// Define the service name for all secrets
const SERVICE_NAME = "secrets-mcp-server";

// Schema definitions for tool inputs
const StoreSecretSchema = z.object({
  key: z.string().describe("The unique identifier for the secret"),
  value: z.string().describe("The secret value to store"),
});

const RetrieveSecretSchema = z.object({
  key: z.string().describe("The unique identifier for the secret to retrieve"),
});

const DeleteSecretSchema = z.object({
  key: z.string().describe("The unique identifier for the secret to delete"),
});

// Create the MCP server with the same configuration as stdio version
function createMcpServer() {
  const server = new Server(
    {
      name: "secrets-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "store_secret",
          description:
            "Securely store a secret using the operating system's native secret storage (Windows Credential Vault/DPAPI, macOS Keychain, or Linux Secret Service). The secret is encrypted and can only be accessed by the current user.",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "The unique identifier for the secret",
              },
              value: {
                type: "string",
                description: "The secret value to store",
              },
            },
            required: ["key", "value"],
          },
        },
        {
          name: "retrieve_secret",
          description:
            "Retrieve a previously stored secret from the operating system's native secret storage. Returns the decrypted secret value if it exists.",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "The unique identifier for the secret to retrieve",
              },
            },
            required: ["key"],
          },
        },
        {
          name: "delete_secret",
          description:
            "Delete a secret from the operating system's native secret storage. This permanently removes the secret.",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "The unique identifier for the secret to delete",
              },
            },
            required: ["key"],
          },
        },
        {
          name: "list_secrets",
          description:
            "List all secret keys stored by this MCP server. Note: This returns only the keys (identifiers), not the actual secret values. Use retrieve_secret to get the values.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "store_secret": {
          const { key, value } = StoreSecretSchema.parse(args);
          
          try {
            const entry = new Entry(SERVICE_NAME, key);
            entry.setPassword(value);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully stored secret with key: ${key}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to store secret: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        case "retrieve_secret": {
          const { key } = RetrieveSecretSchema.parse(args);
          
          try {
            const entry = new Entry(SERVICE_NAME, key);
            const secret = entry.getPassword();
            if (secret === null) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No secret found with key: ${key}`,
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: secret,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to retrieve secret: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        case "delete_secret": {
          const { key } = DeleteSecretSchema.parse(args);
          
          try {
            const entry = new Entry(SERVICE_NAME, key);
            const deleted = entry.deletePassword();
            if (!deleted) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No secret found with key: ${key}`,
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted secret with key: ${key}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to delete secret: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        case "list_secrets": {
          try {
            const credentials = findCredentials(SERVICE_NAME);
            const keys = credentials.map(cred => cred.account);
            
            if (keys.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No secrets stored yet.",
                  },
                ],
              };
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: `Stored secret keys:\n${keys.map(k => `- ${k}`).join('\n')}`,
                },
              ],
            };
          } catch (error) {
            // On some platforms (especially Linux in certain environments), 
            // listing credentials may fail due to permission restrictions
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Permission denied') || errorMessage.includes('DBus')) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Listing secrets is not available in this environment due to system permissions. This is a known limitation on some Linux systems with restrictive DBus/Secret Service configurations. Secrets can still be stored and retrieved individually by key.",
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to list secrets: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Start the HTTP server
async function main() {
  // Get configuration from environment variables
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "localhost";

  // Create MCP server instance
  const mcpServer = createMcpServer();

  // Create HTTP transport with session management and JSON response mode for simpler HTTP clients
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true, // Enable JSON responses instead of SSE for simpler HTTP interaction
  });

  // Connect the MCP server to the transport
  await mcpServer.connect(transport);

  // Create HTTP server that handles requests
  const httpServer = createServer(async (req, res) => {
    // Enable CORS for development/testing
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Session-Id, MCP-Protocol-Version");
    res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Handle MCP requests through the transport
    await transport.handleRequest(req, res);
  });

  // Start listening
  httpServer.listen(PORT, HOST, () => {
    console.log(`Secrets MCP Server running on http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", () => {
    console.error("SIGTERM received, closing server...");
    httpServer.close(() => {
      console.error("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.error("SIGINT received, closing server...");
    httpServer.close(() => {
      console.error("Server closed");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
