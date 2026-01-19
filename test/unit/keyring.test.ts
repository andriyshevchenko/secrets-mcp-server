import { describe, it, expect, afterEach } from 'vitest';
import { Entry, findCredentials } from '@napi-rs/keyring';

const TEST_SERVICE = 'secrets-mcp-server-test';

describe('Keyring Integration Tests', () => {
  const testKeys: string[] = [];

  afterEach(() => {
    // Clean up any test secrets
    testKeys.forEach((key) => {
      try {
        const entry = new Entry(TEST_SERVICE, key);
        entry.deletePassword();
      } catch {
        // Ignore cleanup errors
      }
    });
    testKeys.length = 0;
  });

  describe('store and retrieve secrets', () => {
    it('should store and retrieve a secret', () => {
      const key = `test-key-${Date.now()}`;
      testKeys.push(key);
      const value = 'my-secret-value';

      const entry = new Entry(TEST_SERVICE, key);
      entry.setPassword(value);

      const retrieved = entry.getPassword();
      expect(retrieved).toBe(value);
    });

    it('should return null for non-existent secret', () => {
      const key = `non-existent-${Date.now()}`;
      testKeys.push(key);

      const entry = new Entry(TEST_SERVICE, key);
      const retrieved = entry.getPassword();

      expect(retrieved).toBeNull();
    });

    it('should overwrite existing secret', () => {
      const key = `test-overwrite-${Date.now()}`;
      testKeys.push(key);

      const entry = new Entry(TEST_SERVICE, key);
      entry.setPassword('original-value');
      entry.setPassword('new-value');

      const retrieved = entry.getPassword();
      expect(retrieved).toBe('new-value');
    });

    it('should handle special characters in secrets', () => {
      const key = `test-special-${Date.now()}`;
      testKeys.push(key);
      const value = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';

      const entry = new Entry(TEST_SERVICE, key);
      entry.setPassword(value);

      const retrieved = entry.getPassword();
      expect(retrieved).toBe(value);
    });

    it('should handle unicode in secrets', () => {
      const key = `test-unicode-${Date.now()}`;
      testKeys.push(key);
      const value = '密码🔐🔑';

      const entry = new Entry(TEST_SERVICE, key);
      entry.setPassword(value);

      const retrieved = entry.getPassword();
      expect(retrieved).toBe(value);
    });
  });

  describe('delete secrets', () => {
    it('should delete an existing secret', () => {
      const key = `test-delete-${Date.now()}`;
      testKeys.push(key);

      const entry = new Entry(TEST_SERVICE, key);
      entry.setPassword('to-be-deleted');

      const deleted = entry.deletePassword();
      expect(deleted).toBe(true);

      const retrieved = entry.getPassword();
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent secret', () => {
      const key = `test-delete-nonexist-${Date.now()}`;
      testKeys.push(key);

      const entry = new Entry(TEST_SERVICE, key);
      const deleted = entry.deletePassword();

      expect(deleted).toBe(false);
    });
  });

  describe('list secrets', () => {
    it('should list stored secrets or handle permission gracefully', () => {
      // This test accounts for environments where listing may not be permitted
      try {
        const credentials = findCredentials(TEST_SERVICE);
        expect(Array.isArray(credentials)).toBe(true);
      } catch (error) {
        // Permission denied is acceptable in some environments
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(
          errorMessage.includes('Permission denied') || 
          errorMessage.includes('DBus')
        ).toBe(true);
      }
    });
  });
});
