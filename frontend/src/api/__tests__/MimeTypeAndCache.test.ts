import { describe, expect, it } from "vitest";

/**
 * Helper to validate module script response headers and content,
 * preventing browser MIME type enforcement errors.
 */
export function validateModuleScriptResponse(contentType: string | null, responseText: string): void {
  if (!contentType) {
    throw new Error("Missing Content-Type header on JavaScript module script response");
  }

  const isHtmlMimeType = contentType.toLowerCase().includes("text/html");
  const isHtmlContent = responseText.trim().toLowerCase().startsWith("<!doctype html") || responseText.trim().toLowerCase().startsWith("<html");

  if (isHtmlMimeType || isHtmlContent) {
    throw new Error(
      `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "${contentType}". Strict MIME type checking is enforced for module scripts per HTML spec.`
    );
  }
}

describe("JavaScript Module Script MIME Type Verification", () => {
  it("should pass for valid JavaScript module script response", () => {
    const contentType = "application/javascript; charset=utf-8";
    const jsContent = 'import { resolveApiUrl } from "/src/api/client.js"; console.log("Module loaded");';

    expect(() => validateModuleScriptResponse(contentType, jsContent)).not.toThrow();
  });

  it("should throw strict MIME type error when server responds with text/html for a JS module request (SPA 404 fallback bug)", () => {
    const contentType = "text/html";
    const fallbackHtmlContent = "<!DOCTYPE html><html><head><title>Reading Fluency</title></head><body><div id='root'></div></body></html>";

    expect(() => validateModuleScriptResponse(contentType, fallbackHtmlContent)).toThrow(
      /Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text\/html"/
    );
  });

  it("should throw error if content starts with <!DOCTYPE html> even if content-type header is ambiguous", () => {
    const contentType = "text/plain";
    const fallbackHtmlContent = "<!doctype html><html><body>Error</body></html>";

    expect(() => validateModuleScriptResponse(contentType, fallbackHtmlContent)).toThrow(
      /Expected a JavaScript-or-Wasm module script/
    );
  });
});
