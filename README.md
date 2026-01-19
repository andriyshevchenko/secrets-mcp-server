# secrets-mcp-server

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

```bash
# If installed globally
secrets-mcp-server

# If running from source
npm start
```

The server communicates via stdio, following the Model Context Protocol standard.

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

### Claude Desktop Configuration

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

## Security Considerations

- Secrets are stored using the operating system's native credential management system
- Access is restricted to the current user account
- On Windows, secrets are encrypted with DPAPI using user or machine-specific keys
- On macOS, secrets are protected by the Keychain's security model
- On Linux, secrets are managed by the Secret Service API with encryption

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
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

