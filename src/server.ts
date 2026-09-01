import fastify from "fastify";
import { ConsistentHashRing } from "./consistentHashRing.js";

const app = fastify({ logger: true });
const ring = new ConsistentHashRing();

ring.addNode({
  id: "node1",
  port: 3001,
  host: "localhost",
});

ring.addNode({
  id: "node2",
  port: 3002,
  host: "localhost",
});

ring.addNode({
  id: "node3",
  port: 3003,
  host: "localhost",
});

app.get<{ Params: { key: string } }>("/cache/:key", async (request, reply) => {
  const { key } = request.params;
  const node = ring.getNode(key);
  if (!node) {
    return reply.status(404).send({
      error: "No node found for the given key",
    });
  }
  const host = node?.host;
  const PORT = node?.port;

  const url = `http://${host}:${PORT}/cache/${key}`;
  console.log("Fetching from node:", url);
  const response = await fetch(url);
  console.log("Response from node:", response);
  if (!response.ok) {
    return reply.status(response.status).send({
      error: "Failed to fetch from node",
    });
  }

  const data = await response.json();
  return reply.status(200).send(data);
});

app.post<{ Body: { key: string; value: unknown; ttl: number } }>(
  "/cache/set",
  async (request, reply) => {
    const { key, value, ttl } = request.body;
    const node = ring.getNode(key);
    if (!node) {
      return reply.status(404).send({
        error: "No node found for the given key",
      });
    }
    const host = node?.host;
    const PORT = node?.port;

    const url = `http://${host}:${PORT}/cache/set`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value, ttl }),
    });

    console.log("Response from node:", response);
    if (!response.ok) {
      return reply.status(response.status).send({
        error: "Failed to fetch from node",
      });
    }

    const data = await response.json();
    return reply.status(200).send(data);
  },
);

app.delete<{ Params: { key: string } }>(
  "/cache/:key",
  async (request, reply) => {
    const { key } = request.params;
    const node = ring.getNode(key);
    if (!node) {
      return reply.status(404).send({
        error: "No node found for the given key",
      });
    }
    const host = node?.host;
    const PORT = node?.port;

    const url = `http://${host}:${PORT}/cache/${key}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });

    console.log("Response from node:", response);
    if (!response.ok) {
      return reply.status(response.status).send({
        error: "Failed to fetch from node",
      });
    }

    const data = await response.json();
    return reply.status(200).send(data);
  },
);
const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server started on port 3000");
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
};

start();
