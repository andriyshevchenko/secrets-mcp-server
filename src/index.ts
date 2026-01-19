#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Entry, findCredentials } from "@napi-rs/keyring";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get package.json path and read version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const VERSION = packageJson.version;

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

// Create the MCP server
const server = new Server(
  {
    name: "secrets-mcp-server",
    version: VERSION,
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Secrets MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
