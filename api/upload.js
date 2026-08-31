import { handleUpload } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { requireUser, approvedTokenUser, ownsBlobPath } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    // POST auth happens in onBeforeGenerateToken via clientPayload — the blob client
    // library issues the token request itself, so we can't rely on our Bearer header there.
    if (req.method === "POST") {
      const jsonResponse = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const user = await approvedTokenUser(clientPayload);
          if (!user) throw new Error("unauthorized");
          // Uploads must land in the caller's own videos/<dir>/ (flat legacy
          // paths stay allowed for the owner, e.g. raw-token devices).
          if (!ownsBlobPath(pathname, user.email)) throw new Error("forbidden path");
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
      const user = await requireUser(req);
      if (!user) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "url required" });
      let pathname;
      try { pathname = new URL(url).pathname; } catch { return res.status(400).json({ error: "invalid url" }); }
      if (!ownsBlobPath(pathname, user.email)) {
        return res.status(403).json({ error: "not your file" });
      }
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
