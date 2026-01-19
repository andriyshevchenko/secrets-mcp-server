import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

class MCPHTTPTestClient {
  private server: ChildProcess | null = null;
  private serverUrl: string;
  private port: number;
  private sessionId: string | null = null;

  constructor(port: number) {
    this.port = port;
    this.serverUrl = `http://localhost:${port}`;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = join(__dirname, '../../build/http-server.js');
      let serverStarted = false;
      let resolved = false;
      
      this.server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PORT: this.port.toString(), HOST: 'localhost' }
      });

      if (!this.server.stdout || !this.server.stderr) {
        reject(new Error('Failed to create server process'));
        return;
      }

      // Listen to stdout for startup message
      this.server.stdout.on('data', (data) => {
        const message = data.toString();
        if (message.includes('MCP Server running') && !resolved) {
          resolved = true;
          serverStarted = true;
          // Give server a moment to be fully ready
          setTimeout(() => resolve(), 200);
        }
      });

      this.server.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!serverStarted && !resolved) {
          resolved = true;
          reject(new Error('Server startup timeout'));
        }
      }, 2000);
    });
  }

  async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = Date.now() + Math.floor(Math.random() * 1000); // More unique IDs combining timestamp and random
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2024-11-05',
    };

    // Include session ID if we have one (for non-initialization requests)
    if (this.sessionId && method !== 'initialize') {
      headers['MCP-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    // Extract session ID from response headers if present
    const responseSessionId = response.headers.get('MCP-Session-Id');
    if (responseSessionId) {
      this.sessionId = responseSessionId;
    }

    const jsonResponse = await response.json();
    return jsonResponse as JsonRpcResponse;
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill('SIGTERM');
      // Give it a moment to terminate gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force kill if still alive
      if (!this.server.killed) {
        this.server.kill('SIGKILL');
      }
      
      this.server = null;
    }
  }
}

describe('HTTP MCP Server E2E Tests', () => {
  let client: MCPHTTPTestClient;
  const testPort = 3456; // Use a non-standard port to avoid conflicts

  beforeAll(async () => {
    client = new MCPHTTPTestClient(testPort);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  describe('Server Initialization', () => {
    it('should initialize successfully via HTTP', async () => {
      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-http-client',
          version: '1.0.0'
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('secrets-mcp-server');
      expect(response.result.serverInfo.version).toBe('1.0.0');
    });
  });

  describe('Tools Listing via HTTP', () => {
    it('should list all available tools', async () => {
      const response = await client.sendRequest('tools/list', {});

      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBe(4);

      const toolNames = response.result.tools.map((t: Record<string, unknown>) => t.name);
      expect(toolNames).toContain('store_secret');
      expect(toolNames).toContain('retrieve_secret');
      expect(toolNames).toContain('delete_secret');
      expect(toolNames).toContain('list_secrets');
    });

    it('should have proper tool descriptions', async () => {
      const response = await client.sendRequest('tools/list', {});
      const tools = response.result.tools;

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });

  describe('Secret Operations via HTTP', () => {
    const testKey = `e2e-http-test-${Date.now()}`;
    const testValue = 'test-secret-value-http-456';

    it('should store a secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'store_secret',
        arguments: {
          key: testKey,
          value: testValue
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Successfully stored');
    });

    it('should retrieve the stored secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'retrieve_secret',
        arguments: {
          key: testKey
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toBe(testValue);
    });

    it('should handle retrieving non-existent secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'retrieve_secret',
        arguments: {
          key: 'non-existent-key-http-' + Date.now()
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('No secret found');
    });

    it('should list secrets or handle permission limitation', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'list_secrets',
        arguments: {}
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      const text = response.result.content[0].text;
      
      // Either lists secrets or returns permission message
      expect(
        text.includes(testKey) || 
        text.includes('not available in this environment')
      ).toBe(true);
    });

    it('should delete the secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'delete_secret',
        arguments: {
          key: testKey
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Successfully deleted');
    });

    it('should handle deleting non-existent secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'delete_secret',
        arguments: {
          key: testKey // Already deleted
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('No secret found');
    });
  });

  describe('Error Handling via HTTP', () => {
    it('should handle unknown tool', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'unknown_tool',
        arguments: {}
      });

      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Unknown tool');
    });

    it('should validate required parameters for store_secret', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'store_secret',
        arguments: {
          key: 'only-key-no-value'
          // Missing 'value' parameter
        }
      });

      expect(response.result).toBeDefined();
      // Should contain validation error - check for error flag or error text
      const hasErrorFlag = response.result.isError === true;
      const hasErrorText = response.result.content && 
                          response.result.content[0] && 
                          response.result.content[0].text.includes('Error');
      expect(hasErrorFlag || hasErrorText).toBeTruthy();
    });
  });

  describe('HTTP Transport Features', () => {
    it('should support CORS headers', async () => {
      const response = await fetch(`http://localhost:${testPort}`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should maintain session across requests', async () => {
      // Use the existing client that's already initialized to test session maintenance
      // The client was initialized in the first test and should maintain its session
      
      // Make a request to verify session is still active
      const toolsResponse = await client.sendRequest('tools/list', {});
      
      expect(toolsResponse.result).toBeDefined();
      expect(toolsResponse.result.tools).toBeDefined();
      
      // Make another request with the same session
      const testKey = `session-test-${Date.now()}`;
      const storeResponse = await client.sendRequest('tools/call', {
        name: 'store_secret',
        arguments: {
          key: testKey,
          value: 'test-value'
        }
      });
      
      expect(storeResponse.result).toBeDefined();
      expect(storeResponse.result.content[0].text).toContain('Successfully stored');
      
      // Clean up
      await client.sendRequest('tools/call', {
        name: 'delete_secret',
        arguments: {
          key: testKey
        }
      });
    });
  });
});
