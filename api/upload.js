import { handleUpload } from "@vercel/blob/client";
import { del } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    // POST auth happens in onBeforeGenerateToken via clientPayload — the blob client
    // library issues the token request itself, so we can't rely on our Bearer header there.
    if (req.method === "POST") {
      const jsonResponse = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!process.env.SYNC_TOKEN || clientPayload !== process.env.SYNC_TOKEN) {
            throw new Error("unauthorized");
          }
          return {
            allowedContentTypes: ["video/*"],
            maximumSizeInBytes: 200 * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
        onUploadCompleted: async () => {},
      });
      return res.status(200).json(jsonResponse);
    }

    if (req.method === "DELETE") {
      if (!process.env.SYNC_TOKEN || req.headers.authorization !== `Bearer ${process.env.SYNC_TOKEN}`) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "url required" });
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
