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

class MCPTestClient {
  private server: ChildProcess | null = null;
  private responseBuffer = '';
  private pendingRequests = new Map<number, (response: JsonRpcResponse) => void>();
  private requestId = 1;
  private serverPath: string;

  constructor(serverPath: string) {
    this.serverPath = serverPath;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.server.stdout || !this.server.stdin) {
        reject(new Error('Failed to create server process'));
        return;
      }

      this.server.stdout.on('data', (data) => {
        this.handleServerData(data);
      });

      this.server.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('MCP Server running')) {
          resolve();
        }
      });

      this.server.on('error', reject);

      // Timeout if server doesn't start
      setTimeout(() => resolve(), 500);
    });
  }

  private handleServerData(data: Buffer): void {
    this.responseBuffer += data.toString();
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id && this.pendingRequests.has(parsed.id)) {
            const handler = this.pendingRequests.get(parsed.id)!;
            this.pendingRequests.delete(parsed.id);
            handler(parsed);
          }
        } catch {
          // Ignore non-JSON output
        }
      }
    }
  }

  async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    if (!this.server || !this.server.stdin) {
      throw new Error('Server not started');
    }

    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, 5000);

      this.pendingRequests.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.server!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }
}

describe('MCP Server E2E Tests', () => {
  let client: MCPTestClient;
  const serverPath = join(__dirname, '../../build/index.js');

  beforeAll(async () => {
    client = new MCPTestClient(serverPath);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  describe('Server Initialization', () => {
    it('should initialize successfully', async () => {
      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      });

      expect(response.result).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('secrets-mcp-server');
      expect(response.result.serverInfo.version).toBe('1.0.0');
    });
  });

  describe('Tools Listing', () => {
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

  describe('Secret Operations', () => {
    const testKey = `e2e-test-${Date.now()}`;
    const testValue = 'test-secret-value-123';

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
          key: 'non-existent-key-' + Date.now()
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

  describe('Error Handling', () => {
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
});
