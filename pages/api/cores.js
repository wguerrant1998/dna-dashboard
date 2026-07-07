import { head } from "@vercel/blob";

const CACHE_KEY = "cores-cache.json";

export default async function handler(req, res) {
  try {
    // Look up the current cache blob's URL, then fetch its contents.
    // head() throws if the blob doesn't exist yet (e.g. refresh-cores hasn't run once yet).
    const meta = await head(CACHE_KEY);

    const cacheRes = await fetch(meta.url);
    if (!cacheRes.ok) {
      return res.status(502).json({ error: "Failed to read cached core data", updatedAt: null, cores: [] });
    }

    const payload = await cacheRes.json();
    return res.status(200).json(payload);
  } catch (error) {
    // Most likely: the cache doesn't exist yet because refresh-cores.js hasn't run successfully yet.
    console.error("cores.js (cache read) error:", error);
    return res.status(200).json({ updatedAt: null, cores: [], note: "No cached data yet - the background refresh job may not have run yet." });
  }
}
