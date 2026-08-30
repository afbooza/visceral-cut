import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const KEY = "catalog";

export default async function handler(req, res) {
  if (!process.env.SYNC_TOKEN || req.headers.authorization !== `Bearer ${process.env.SYNC_TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const catalog = await redis.hgetall(KEY);
      return res.status(200).json({ catalog: catalog || {} });
    }

    if (req.method === "POST") {
      const { id, item, items } = req.body || {};
      // Bulk merge — used by syncNow to push items the server is missing
      if (items && typeof items === "object") {
        if (Object.keys(items).length) await redis.hset(KEY, items);
        return res.status(200).json({ ok: true, count: Object.keys(items).length });
      }
      if (!id || !item) return res.status(400).json({ error: "id and item required" });
      await redis.hset(KEY, { [id]: item });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id required" });
      await redis.hdel(KEY, id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
