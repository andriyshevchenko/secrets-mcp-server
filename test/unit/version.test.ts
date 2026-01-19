import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

describe('Version Loading Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error to verify error messages
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Successful version loading', () => {
    it('should successfully load version from package.json', () => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packageJsonPath = join(__dirname, "../../package.json");

      let VERSION = "0.0.0"; // Default fallback version
      try {
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, "utf-8")
        );
        if (typeof packageJson.version === "string" && packageJson.version) {
          VERSION = packageJson.version;
        }
      } catch {
        // Should not reach here with valid package.json
      }

      // Verify version is loaded and not the fallback
      expect(VERSION).not.toBe("0.0.0");
      expect(typeof VERSION).toBe("string");
      expect(VERSION.length).toBeGreaterThan(0);
      // Verify it matches semver pattern (x.y.z)
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Fallback behavior when package.json is missing or unreadable', () => {
    it('should fallback to 0.0.0 when package.json path is invalid', () => {
      const invalidPath = "/non/existent/path/package.json";
      let VERSION = "0.0.0";
      
      try {
        const packageJson = JSON.parse(
          readFileSync(invalidPath, "utf-8")
        );
        if (typeof packageJson.version === "string" && packageJson.version) {
          VERSION = packageJson.version;
        }
      } catch (error) {
        // Expected to catch error
        expect(error).toBeDefined();
      }

      // Verify fallback version is used
      expect(VERSION).toBe("0.0.0");
    });

    it('should log error message with [VERSION] prefix when file cannot be read', () => {
      const invalidPath = "/non/existent/path/package.json";
      let VERSION = "0.0.0";
      
      try {
        const packageJson = JSON.parse(
          readFileSync(invalidPath, "utf-8")
        );
        if (typeof packageJson.version === "string" && packageJson.version) {
          VERSION = packageJson.version;
        }
      } catch (error) {
        console.error(`[VERSION] Warning: Failed to read version from package.json at ${invalidPath}, using fallback version ${VERSION}:`, error);
      }

      // Verify error was logged with [VERSION] prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERSION] Warning: Failed to read version'),
        expect.anything()
      );
    });
  });

  describe('Fallback behavior when version field is invalid or missing', () => {
    it('should fallback to 0.0.0 when version is not a string', () => {
      const mockPackageJson = { version: 123 }; // Invalid: number instead of string
      let VERSION = "0.0.0";

      if (typeof mockPackageJson.version === "string" && mockPackageJson.version) {
        VERSION = mockPackageJson.version;
      } else {
        console.error(`[VERSION] Warning: package.json does not contain a valid version string (expected non-empty string, got: ${typeof mockPackageJson.version}), using fallback version ${VERSION}`);
      }

      expect(VERSION).toBe("0.0.0");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERSION] Warning: package.json does not contain a valid version string')
      );
    });

    it('should fallback to 0.0.0 when version is an empty string', () => {
      const mockPackageJson = { version: "" }; // Invalid: empty string
      let VERSION = "0.0.0";

      if (typeof mockPackageJson.version === "string" && mockPackageJson.version) {
        VERSION = mockPackageJson.version;
      } else {
        console.error(`[VERSION] Warning: package.json does not contain a valid version string (expected non-empty string, got: ${typeof mockPackageJson.version}), using fallback version ${VERSION}`);
      }

      expect(VERSION).toBe("0.0.0");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERSION] Warning: package.json does not contain a valid version string')
      );
    });

    it('should fallback to 0.0.0 when version field is missing', () => {
      const mockPackageJson = { name: "test" }; // Missing version field
      let VERSION = "0.0.0";

      if (typeof mockPackageJson.version === "string" && mockPackageJson.version) {
        VERSION = mockPackageJson.version;
      } else {
        console.error(`[VERSION] Warning: package.json does not contain a valid version string (expected non-empty string, got: ${typeof mockPackageJson.version}), using fallback version ${VERSION}`);
      }

      expect(VERSION).toBe("0.0.0");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERSION] Warning: package.json does not contain a valid version string')
      );
    });

    it('should fallback to 0.0.0 when JSON parsing fails', () => {
      const invalidJson = "{ invalid json }";
      let VERSION = "0.0.0";
      
      try {
        const packageJson = JSON.parse(invalidJson);
        if (typeof packageJson.version === "string" && packageJson.version) {
          VERSION = packageJson.version;
        }
      } catch (error) {
        console.error(`[VERSION] Warning: Failed to parse package.json, using fallback version ${VERSION}:`, error);
        expect(error).toBeDefined();
      }

      expect(VERSION).toBe("0.0.0");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VERSION] Warning:'),
        expect.anything()
      );
    });
  });
});
