// Thin client for the /api serverless routes backed by Upstash Redis.
// All calls require a sync token (stored in localStorage, sent as a Bearer header).

const TOKEN_KEY = "tony-workout-sync-token";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};

export const saveToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
};

async function api(path, opts = {}) {
  const token = getToken();
  if (!token) throw new Error("no-token");
  const res = await fetch(`/api/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`api-${res.status}`);
  return res.json();
}

export const fetchLogs = () => api("logs").then((r) => r.logs || {});
export const pushLog = (date, log) => api("logs", { method: "POST", body: JSON.stringify({ date, log }) });
export const pushLogsBulk = (logs) => api("logs", { method: "POST", body: JSON.stringify({ logs }) });
export const removeLog = (date) => api(`logs?date=${encodeURIComponent(date)}`, { method: "DELETE" });

export const fetchDraft = () => api("draft").then((r) => r.draft || null);
export const pushDraft = (draft) => api("draft", { method: "POST", body: JSON.stringify({ draft }) });
export const clearRemoteDraft = () => api("draft", { method: "DELETE" });
