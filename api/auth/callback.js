import { mintSession, verifyState, callbackUrl, isApproved, USERS_KEY } from "../_lib/auth.js";
import { redis } from "../_lib/redis.js";

const fail = (res, msg) => res.redirect(302, `/#autherr=${encodeURIComponent(msg)}`);

export default async function handler(req, res) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SYNC_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SYNC_TOKEN) return fail(res, "auth not configured");

  const { code, state, error } = req.query;
  if (error) return fail(res, error);
  if (!code || !verifyState(state, SYNC_TOKEN)) return fail(res, "invalid state — try again");

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(req),
        grant_type: "authorization_code",
      }),
    });
    const { id_token } = await r.json();
    if (!r.ok || !id_token) return fail(res, "token exchange failed");

    // The ID token comes straight from Google's token endpoint over TLS, so claim
    // checks suffice — no JWKS signature verification needed for this flow.
    const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString());
    const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (!issOk || claims.aud !== GOOGLE_CLIENT_ID || !claims.email || claims.email_verified === false) {
      return fail(res, "invalid Google token");
    }
    // Self-serve signup: unknown emails are recorded as a pending request for
    // the owner to approve in Settings, instead of being rejected outright.
    const email = claims.email.toLowerCase();
    if (!(await isApproved(email))) {
      const existing = await redis.hget(USERS_KEY, email);
      if (!existing) await redis.hset(USERS_KEY, { [email]: { status: "pending", ts: Date.now() } });
      return res.redirect(302, `/#pending=${encodeURIComponent(email)}`);
    }
    return res.redirect(302, `/#auth=${mintSession(email, SYNC_TOKEN)}`);
  } catch (e) {
    return fail(res, "sign-in failed");
  }
}
