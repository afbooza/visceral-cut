import { redis } from "./_lib/redis.js";
import { requireUser } from "./_lib/auth.js";

export default async function handler(req, res) {
  const user = await requireUser(req);
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
