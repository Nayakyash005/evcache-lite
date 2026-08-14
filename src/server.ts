import fastify from "fastify";
import cacheService from "./cacheService.js";

const app = fastify({ logger: true });

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
  if (!key) return reply.status(400).send({ error: "key required" });
  cacheService.set(key, value, typeof ttl === "number" ? ttl : undefined);
  return { ok: true, key };
});

app.get<{ Params: CacheParams }>(
  "/cache/:key",
  async (request, reply) => {
    const { key } = request.params;
    const value = cacheService.get(key);
    if (value === undefined)
      return reply.status(404).send({ error: "not found" });
    return { key, value };
  }
);

app.delete<{ Params: CacheParams }>(
  "/cache/:key",
  async (request, reply) => {
    const { key } = request.params;
    const deleted = cacheService.delete(key);
    return { key, deleted };
  }
);

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
