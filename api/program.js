import { Redis } from "@upstash/redis";
import { bearerOk } from "./_lib/auth.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const KEY = "program";

export default async function handler(req, res) {
  if (!bearerOk(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const program = await redis.get(KEY);
      return res.status(200).json({ program: program || null });
    }

    if (req.method === "POST") {
      const { program } = req.body || {};
      if (!program) return res.status(400).json({ error: "program required" });
      await redis.set(KEY, program);
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
