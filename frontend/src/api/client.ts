const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Resolves the GraphQL API URL, ensuring mixed content (HTTP on HTTPS pages)
 * is automatically prevented by upgrading to HTTPS or falling back to relative proxy routing.
 */
export function resolveApiUrl(
  configuredUrl: string = CONFIGURED_API_URL,
  location?: { protocol: string; host: string }
): string {
  const currentProtocol =
    location?.protocol ||
    (typeof window !== "undefined" ? window.location.protocol : "http:");

  if (configuredUrl.startsWith("/")) {
    return configuredUrl;
  }

  if (currentProtocol === "https:" && configuredUrl.startsWith("http://")) {
    if (
      configuredUrl.includes(".elb.amazonaws.com") ||
      configuredUrl.includes("localhost")
    ) {
      return "/graphql";
    }
    return configuredUrl.replace(/^http:\/\//, "https://");
  }

  return configuredUrl;
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = resolveApiUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Network error talking to the API (${res.status})`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message || "The API returned an error");
  }

  return json.data as T;
}
