import { Redis } from "@upstash/redis";
import { bearerUser } from "./_lib/auth.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const user = bearerUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const KEY = `draft:${user.email}`;

  try {
    if (req.method === "GET") {
      const draft = await redis.get(KEY);
      return res.status(200).json({ draft: draft || null });
    }

    if (req.method === "POST") {
      const { draft } = req.body || {};
      if (!draft) return res.status(400).json({ error: "draft required" });
      await redis.set(KEY, draft);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis.del(KEY);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
