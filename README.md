# secrets-mcp-server

[![CI](https://github.com/andriyshevchenko/secrets-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/andriyshevchenko/secrets-mcp-server/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server that enables AI agents to securely store and retrieve secrets using native operating system APIs.

## Features

- **Cross-Platform Secret Storage**: Uses native OS secret management:
  - **Windows**: Windows Credential Vault with DPAPI (Data Protection API)
  - **macOS**: Apple Keychain
  - **Linux**: Secret Service API (GNOME Keyring, KWallet)
- **MCP Tools with Descriptive Names**: Easy for AI agents to discover and use
- **Docker Support**: Containerized deployment for Linux environments
- **Secure by Default**: Secrets are encrypted by the operating system

## Installation

### From npm (once published)

```bash
npm install -g secrets-mcp-server
```

### From source

```bash
git clone https://github.com/andriyshevchenko/secrets-mcp-server.git
cd secrets-mcp-server
npm install
npm run build
```

## Usage

### Running the Server

The server supports two transport modes: **stdio** (default) and **HTTP**.

#### Stdio Transport (Default)

```bash
# If installed globally
secrets-mcp-server

# If running from source
npm start
```

The server communicates via stdio, following the Model Context Protocol standard. This is the recommended mode for local development and integration with tools like Claude Desktop.

#### HTTP Transport

```bash
# If installed globally
secrets-mcp-server-http

# If running from source
npm run start:http
```

The HTTP server listens on `http://localhost:3000` by default. You can configure the port and host using environment variables:

```bash
# Custom port and host
PORT=8080 HOST=0.0.0.0 secrets-mcp-server-http
```

The HTTP transport implements the MCP Streamable HTTP specification with JSON responses, supporting:
- **Session Management**: Each client gets a unique session ID for request tracking
- **CORS Support**: Enabled for development and testing
- **RESTful API**: Standard HTTP POST requests with JSON-RPC 2.0 payloads

**HTTP Request Example:**
```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2024-11-05" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### Available Tools

The server provides four tools for managing secrets:

#### 1. `store_secret`

Securely store a secret using the OS's native secret storage.

**Parameters:**
- `key` (string): Unique identifier for the secret
- `value` (string): The secret value to store

**Example:**
```json
{
  "key": "api_token",
  "value": "sk-1234567890abcdef"
}
```

#### 2. `retrieve_secret`

Retrieve a previously stored secret.

**Parameters:**
- `key` (string): The unique identifier for the secret

**Example:**
```json
{
  "key": "api_token"
}
```

#### 3. `delete_secret`

Permanently delete a secret from storage.

**Parameters:**
- `key` (string): The unique identifier for the secret to delete

**Example:**
```json
{
  "key": "api_token"
}
```

#### 4. `list_secrets`

List all secret keys (identifiers) stored by this server. Note: This returns only the keys, not the actual secret values.

**Parameters:** None

**Note:** On some Linux systems with restrictive DBus or Secret Service configurations, this operation may not be available due to system permission restrictions. In such cases, secrets can still be stored and retrieved individually by key.

## Docker Deployment

Build and run using Docker:

```bash
# Build the image
docker build -t secrets-mcp-server .

# Run the container
docker run -i secrets-mcp-server
```

**Note:** In containerized environments, the Linux Secret Service API is used. You may need to configure the secret service backend depending on your container setup.

## Configuration for MCP Clients

To use this server with an MCP client (like Claude Desktop), add it to your MCP configuration:

### Claude Desktop Configuration (Stdio Transport)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "secrets": {
      "command": "npx",
      "args": ["-y", "secrets-mcp-server"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "secrets": {
      "command": "secrets-mcp-server"
    }
  }
}
```

### HTTP Transport Configuration

If you prefer to use the HTTP transport (for example, when running the server as a standalone service or in a containerized environment), you can configure your MCP client to connect to the HTTP endpoint:

```json
{
  "mcpServers": {
    "secrets": {
      "url": "http://localhost:3000"
    }
  }
}
```

**Note:** HTTP transport support depends on your MCP client. Some clients may only support stdio transport. The HTTP transport is useful for:
- Running the server as a standalone microservice
- Accessing the server from multiple clients simultaneously
- Deploying in containerized or cloud environments
- Integration with web-based applications

## Security Considerations

- Secrets are stored using the operating system's native credential management system
- Access is restricted to the current user account
- On Windows, secrets are encrypted with DPAPI using user or machine-specific keys
- On macOS, secrets are protected by the Keychain's security model
- On Linux, secrets are managed by the Secret Service API with encryption

### HTTP Transport Security

When using the HTTP transport:
- The server binds to `localhost` by default, restricting access to the local machine
- CORS is enabled for development; consider restricting it in production environments
- Session IDs are randomly generated UUIDs for request tracking
- Consider using HTTPS/TLS when exposing the server over a network
- Implement authentication middleware for production deployments
- The HTTP transport is best suited for local or trusted network environments

## Requirements

### System Requirements

- **Node.js**: 18.x or later
- **Operating Systems**:
  - Windows 10 or later (with Credential Manager)
  - macOS 10.12 or later (with Keychain)
  - Linux with Secret Service support (GNOME Keyring or KWallet)

### Linux Dependencies

On Linux, you need `libsecret` installed:

```bash
# Debian/Ubuntu
sudo apt-get install libsecret-1-dev

# Fedora/RHEL
sudo dnf install libsecret-devel

# Arch Linux
sudo pacman -S libsecret
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

# Run tests
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:e2e      # Run e2e tests only
npm run test:coverage # Run tests with coverage

# Linting
npm run lint          # Check for lint errors
npm run lint:fix      # Fix lint errors automatically
```

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Test the @napi-rs/keyring integration for storing, retrieving, and deleting secrets
- **E2E Tests**: Test the MCP server protocol implementation end-to-end

Run tests with:
```bash
npm test
```

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Lint**: Checks code quality with ESLint
- **Build**: Compiles TypeScript to JavaScript
- **Test**: Runs unit and e2e tests with coverage
- **Docker Build**: Builds and validates Docker image
- **Publish**: Automatically publishes to Docker Hub on main branch

The CI workflow runs on all branches for push and pull request events.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

