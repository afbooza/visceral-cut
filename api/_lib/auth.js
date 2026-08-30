// Shared auth for all API routes. Two accepted bearer tokens:
//  - a Google-login session token: `v1.<base64url payload>.<hmac>`, minted by
//    api/auth/callback.js after OIDC verification, signed with SYNC_TOKEN
//  - the legacy shared secret (SYNC_TOKEN itself), still used by older devices
import crypto from "crypto";

const sign = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

export function mintSession(email, secret, days = 90) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + days * 864e5 })).toString("base64url");
  return `v1.${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token) {
  const secret = process.env.SYNC_TOKEN;
  if (!secret || !token) return false;
  if (token === secret) return true;
  const [v, payload, sig] = token.split(".");
  if (v !== "v1" || !payload || !sig) return false;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    const allowed = (process.env.ALLOWED_EMAIL || "").trim().toLowerCase();
    return exp > Date.now() && !!email && (!allowed || email.toLowerCase() === allowed);
  } catch {
    return false;
  }
}

export const bearerOk = (req) => verifyToken((req.headers.authorization || "").replace(/^Bearer /, ""));

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
