// Shared auth for all API routes. Two accepted bearer tokens:
//  - a Google-login session token: `v1.<base64url payload>.<hmac>`, minted by
//    api/auth/callback.js after OIDC verification, signed with SYNC_TOKEN
//  - the legacy shared secret (SYNC_TOKEN itself), attributed to the owner —
//    the first ALLOWED_EMAIL entry — and rejected when no allowlist is set
// Every route resolves a token to WHO it belongs to ({ email }), because all
// data in Redis and Blob is namespaced per user.
import crypto from "crypto";

const sign = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

// ALLOWED_EMAIL is a comma-separated allowlist; empty/unset = open signup.
// The first entry is the "owner": legacy tokens and pre-multiuser flat blob
// paths resolve to that account.
export const allowlist = () =>
  (process.env.ALLOWED_EMAIL || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

export function mintSession(email, secret, days = 90) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + days * 864e5 })).toString("base64url");
  return `v1.${payload}.${sign(payload, secret)}`;
}

// Verify a bearer token and resolve its account → { email } | null
export function tokenUser(token) {
  const secret = process.env.SYNC_TOKEN;
  if (!secret || !token) return null;
  if (token === secret) {
    const owner = allowlist()[0];
    return owner ? { email: owner } : null;
  }
  const [v, payload, sig] = token.split(".");
  if (v !== "v1" || !payload || !sig) return null;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!(exp > Date.now()) || !email) return null;
    const lower = String(email).toLowerCase();
    const list = allowlist();
    if (list.length && !list.includes(lower)) return null;
    return { email: lower };
  } catch {
    return null;
  }
}

export const bearerUser = (req) => tokenUser((req.headers.authorization || "").replace(/^Bearer /, ""));

// Per-user Blob directory — readable slug + short hash so distinct emails can
// never collide. Mirrored byte-for-byte in src/sync.js (blobDir).
export const blobDir = (email) =>
  `${email.replace(/[^a-z0-9]/g, "_")}-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 8)}`;

// May `email` touch this blob pathname? Their own videos/<dir>/ tree, plus —
// for the owner only — pre-multiuser flat videos/<file> paths.
export function ownsBlobPath(pathname, email) {
  const p = (pathname || "").replace(/^\//, "");
  if (!p.startsWith("videos/")) return false;
  const rest = p.slice("videos/".length);
  if (rest.startsWith(`${blobDir(email)}/`)) return true;
  return !rest.includes("/") && allowlist()[0] === email;
}

// Self-authenticating OAuth state: signed timestamp, verified on callback (10 min window)
export const mintState = (secret) => {
  const payload = Buffer.from(JSON.stringify({ t: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
};

export function verifyState(state, secret) {
  const [payload, sig] = (state || "").split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    return Date.now() - JSON.parse(Buffer.from(payload, "base64url").toString()).t < 600_000;
  } catch {
    return false;
  }
}

export function callbackUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/callback`;
}
