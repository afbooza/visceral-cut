import { Redis } from "@upstash/redis";

// Supports both env var naming schemes: Upstash direct (UPSTASH_*) and
// Vercel Marketplace / KV (KV_REST_API_*).
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const KEY = "logs";

export default async function handler(req, res) {
  if (!process.env.SYNC_TOKEN || req.headers.authorization !== `Bearer ${process.env.SYNC_TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const logs = await redis.hgetall(KEY);
      return res.status(200).json({ logs: logs || {} });
    }

    if (req.method === "POST") {
      const { date, log, logs } = req.body || {};
      // Bulk merge — used for initial migration of localStorage history
      if (logs && typeof logs === "object") {
        if (Object.keys(logs).length) await redis.hset(KEY, logs);
        return res.status(200).json({ ok: true, count: Object.keys(logs).length });
      }
      if (!date || !log) return res.status(400).json({ error: "date and log required" });
      await redis.hset(KEY, { [date]: log });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: "date required" });
      await redis.hdel(KEY, date);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
