import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "../client";

const DUMMY_CLOUDFRONT_HOST = "dummy.cloudfront.net";
const DUMMY_ALB_URL = "http://dummy-alb-1234567890.us-east-1.elb.amazonaws.com:4000/";

describe("resolveApiUrl - Mixed Content Prevention", () => {
  it("should return relative URL as-is when passed a relative path like '/graphql'", () => {
    const url = resolveApiUrl("/graphql", { protocol: "https:", host: DUMMY_CLOUDFRONT_HOST });
    expect(url).toBe("/graphql");
  });

  it("should return HTTP URL as-is when page is loaded over HTTP (local development)", () => {
    const url = resolveApiUrl("http://localhost:4000", { protocol: "http:", host: "localhost:5173" });
    expect(url).toBe("http://localhost:4000");
  });

  it("should resolve insecure HTTP ALB URL to relative '/graphql' when page is loaded over HTTPS", () => {
    const url = resolveApiUrl(DUMMY_ALB_URL, { protocol: "https:", host: DUMMY_CLOUDFRONT_HOST });
    expect(url).toBe("/graphql");
    expect(url).not.toContain("http://");
    expect(url).not.toContain(".elb.amazonaws.com");
  });

  it("should upgrade standard HTTP URL to HTTPS when loaded on an HTTPS page", () => {
    const httpUrl = "http://api.example.com/graphql";
    const url = resolveApiUrl(httpUrl, { protocol: "https:", host: "app.example.com" });
    expect(url).toBe("https://api.example.com/graphql");
  });

  it("should retain configured HTTPS URL when loaded on an HTTPS page", () => {
    const httpsUrl = "https://api.example.com/graphql";
    const url = resolveApiUrl(httpsUrl, { protocol: "https:", host: "app.example.com" });
    expect(url).toBe("https://api.example.com/graphql");
  });
});
