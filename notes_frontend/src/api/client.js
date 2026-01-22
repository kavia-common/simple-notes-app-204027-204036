const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Tries to build a helpful error message from a failed fetch response.
 */
async function buildErrorMessage(response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      // Common FastAPI error shapes: { detail: "..." } or { detail: [{msg, ...}, ...] }
      if (typeof data?.detail === "string") return data.detail;
      if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg;
      return JSON.stringify(data);
    }
    const text = await response.text();
    return text || response.statusText;
  } catch {
    return response.statusText || "Request failed";
  }
}

/**
 * Lightweight fetch wrapper with JSON handling + timeout + error handling.
 */
async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
  const baseUrl = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal || controller.signal,
    });

    if (!response.ok) {
      const message = await buildErrorMessage(response);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    // Some endpoints might return empty bodies; handle safely.
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  request,
};
