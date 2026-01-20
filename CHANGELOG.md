# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version check CI job to prevent merging without version bump
- Release notes file (CHANGELOG.md)

## [1.0.0] - 2026-01-20

### Added
- Initial release of secrets-mcp-server
- Cross-platform secret storage using native OS APIs:
  - Windows Credential Vault with DPAPI
  - macOS Keychain
  - Linux Secret Service API
- MCP tools for secret management:
  - `store_secret` - Store secrets securely
  - `retrieve_secret` - Retrieve stored secrets
  - `delete_secret` - Delete secrets
  - `list_secrets` - List all secret keys
- Docker support for containerized deployment
- Comprehensive test coverage (unit and e2e tests)
- CI/CD pipeline with GitHub Actions
- Automated publishing to NPM and Docker Hub
- Documentation and usage examples

[Unreleased]: https://github.com/andriyshevchenko/secrets-mcp-server/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/andriyshevchenko/secrets-mcp-server/releases/tag/v1.0.0
