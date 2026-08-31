// Thin client for the /api serverless routes backed by Upstash Redis.
// All calls require a sync token (stored in localStorage, sent as a Bearer header).

import { upload } from "@vercel/blob/client";

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

export const fetchCatalog = () => api("catalog").then((r) => r.catalog || {});
export const pushCatalogItem = (id, item) => api("catalog", { method: "POST", body: JSON.stringify({ id, item }) });
export const pushCatalogBulk = (items) => api("catalog", { method: "POST", body: JSON.stringify({ items }) });
export const removeCatalogItem = (id) => api(`catalog?id=${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchProgram = () => api("program").then((r) => r.program || null);
export const pushProgram = (program) => api("program", { method: "POST", body: JSON.stringify({ program }) });

// Member management — owner only; non-owners get a 403 (api-403), which the
// Settings view uses to hide the Members card.
export const fetchMembers = () => api("users").then((r) => r.users || {});
export const approveMember = (email) => api("users", { method: "POST", body: JSON.stringify({ email }) });
export const removeMember = (email) => api(`users?email=${encodeURIComponent(email)}`, { method: "DELETE" });

// Per-user Blob directory — readable slug + short hash; must match blobDir in
// api/_lib/auth.js byte-for-byte (the server rejects paths outside your dir).
async function blobDir(email) {
  const bytes = new TextEncoder().encode(email);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${email.replace(/[^a-z0-9]/g, "_")}-${hex.slice(0, 8)}`;
}

// Direct-to-Blob client upload — bypasses the 4.5MB serverless body limit.
// Auth rides in clientPayload because the blob library makes the token request itself.
export const uploadVideo = async (file, onProgress) => {
  const email = sessionInfo()?.email?.toLowerCase();
  // Legacy raw-token devices have no email — they upload flat paths, which the
  // server only permits for the owner account.
  const dir = email ? `${await blobDir(email)}/` : "";
  return upload(`videos/${dir}${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: getToken(),
    multipart: true,
    onUploadProgress: (p) => onProgress?.(Math.round(p.percentage)),
  });
};

export const deleteVideo = (url) => api(`upload?url=${encodeURIComponent(url)}`, { method: "DELETE" });

export const isBlobVideo = (url) => !!url && url.includes(".blob.vercel-storage.com");

// Google-login session tokens look like `v1.<base64url payload>.<sig>`; the legacy
// shared secret is opaque, so this returns null for it (and any garbage).
export const sessionInfo = (token = getToken()) => {
  try {
    const [v, payload] = (token || "").split(".");
    if (v !== "v1" || !payload) return null;
    const { email, exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return email ? { email, exp } : null;
  } catch {
    return null;
  }
};
