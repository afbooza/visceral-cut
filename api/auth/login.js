import { mintState, callbackUrl } from "../_lib/auth.js";

export default function handler(req, res) {
  const { GOOGLE_CLIENT_ID, SYNC_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !SYNC_TOKEN) {
    return res.status(500).json({ error: "auth not configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" });
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackUrl(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", mintState(SYNC_TOKEN));
  url.searchParams.set("prompt", "select_account");
  res.redirect(302, url.toString());
}
