import { redis } from "./_lib/redis.js";
import { requireUser, allowlist, USERS_KEY } from "./_lib/auth.js";

// Owner-only member management. GET lists sign-up requests and approved
// members; POST approves an email (also works as a manual pre-approval before
// the person ever signs in); DELETE denies a pending request or revokes an
// approved member (their namespaced data stays in Redis — re-approving
// restores access to it).
export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (user.email !== allowlist()[0]) {
    return res.status(403).json({ error: "owner only" });
  }

  try {
    if (req.method === "GET") {
      const users = await redis.hgetall(USERS_KEY);
      return res.status(200).json({ users: users || {} });
    }

    if (req.method === "POST") {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return res.status(400).json({ error: "email required" });
      const existing = await redis.hget(USERS_KEY, email);
      await redis.hset(USERS_KEY, { [email]: { status: "approved", ts: existing?.ts || Date.now() } });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "email required" });
      await redis.hdel(USERS_KEY, email);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
