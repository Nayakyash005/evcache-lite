import fastify from "fastify";
import { CacheService } from "./cacheService.js";

const app = fastify({ logger: true });

const cacheService = new CacheService();
interface SetCacheRequest {
  key: string;
  value: unknown;
  ttl?: number;
}

interface CacheParams {
  key: string;
}

app.get("/health", async (request, reply) => {
  return { ok: true };
});

app.post<{ Body: SetCacheRequest }>("/cache/set", async (request, reply) => {
  const { key, value, ttl } = request.body;
  console.log("Received request to set cache:", { key, value, ttl });
  if (!key) return reply.status(400).send({ error: "key required" });
  cacheService.set(key, value, typeof ttl === "number" ? ttl : undefined);
  return { ok: true, key };
});

app.get<{ Params: CacheParams }>("/cache/:key", async (request, reply) => {
  const { key } = request.params;
  console.log("Received request to get cache:", { key });
  const value = cacheService.get(key);
  if (value === undefined)
    return reply.status(404).send({ error: "not found" });
  return { key, value };
});

app.delete<{ Params: CacheParams }>("/cache/:key", async (request, reply) => {
  const { key } = request.params;
  console.log("Received request to delete cache:", { key });
  const deleted = cacheService.delete(key);
  return { key, deleted };
});

export const start = async (port: number) => {
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// start();
