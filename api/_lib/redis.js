import { Redis } from "@upstash/redis";

// Supports both env var naming schemes: Upstash direct (UPSTASH_*) and
// Vercel Marketplace / KV (KV_REST_API_*).
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
