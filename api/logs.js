import { redis } from "./_lib/redis.js";
import { requireUser } from "./_lib/auth.js";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const KEY = `logs:${user.email}`;

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
