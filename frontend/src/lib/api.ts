export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("neuroview_token");
}

export function setToken(token: string) {
  localStorage.setItem("neuroview_token", token);
  window.dispatchEvent(new Event("neuroview-auth-change"));
}

export function clearToken() {
  localStorage.removeItem("neuroview_token");
  window.dispatchEvent(new Event("neuroview-auth-change"));
}

export function getAuthHeaders(extraHeaders: HeadersInit = {}) {
  const token = getToken();
  const headers = new Headers(extraHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String((payload as { detail?: unknown }).detail) : "Request failed.";
    throw new Error(detail);
  }

  return (payload as T) ?? ({} as T);
}

export function getPredictionImageUrl(reference: string | null | undefined): string | null {
  if (!reference) return null;
  return `${API_URL}/${reference.replace(/\\/g, "/")}`;
}
