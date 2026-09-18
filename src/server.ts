import fastify from "fastify";
import {
  ConsistentHashRing,
  NodeHealthManager,
  type CacheNode,
} from "./consistentHashRing.js";

const app = fastify({ logger: true });
const ring = new ConsistentHashRing();
const nodeHealthManager = new NodeHealthManager();

const nodes: CacheNode[] = [
  { id: "node1", port: 3001, host: "localhost" },
  { id: "node2", port: 3002, host: "localhost" },
  { id: "node3", port: 3003, host: "localhost" },
];

for (const node of nodes) {
  ring.addNode(node);
}

const checkNodeHealth = async (node: CacheNode): Promise<boolean> => {
  try {
    const response = await fetch(`http://${node.host}:${node.port}/health`);
    const ok = response.ok;
    nodeHealthManager.setNodehealth(node.id, ok);
    return ok;
  } catch (error) {
    nodeHealthManager.setNodehealth(node.id, false);
    return false;
  }
};

const getHealthyNode = async (
  preferredNode: CacheNode,
  attemptedNode: Set<string>,
): Promise<{ node: CacheNode | undefined; isReplica: boolean }> => {
  if (await checkNodeHealth(preferredNode)) {
    attemptedNode.add(preferredNode.id);
    return { node: preferredNode, isReplica: false };
  }

  for (const replica of nodes) {
    if (replica.id === preferredNode.id && attemptedNode.has(replica.id))
      continue;
    if (await checkNodeHealth(replica)) {
      return { node: replica, isReplica: true };
    }
  }

  return { node: undefined, isReplica: false };
};

const buildNodeUrl = (node: CacheNode, path: string): string =>
  `http://${node.host}:${node.port}${path}`;

const forwardToHealthyNode = async <T>(
  preferredNode: CacheNode,
  path: string,
  options?: RequestInit,
): Promise<{
  data?: T;
  node?: CacheNode;
  isReplica: boolean;
  status: number;
}> => {
  const attemptedNode = new Set<string>();
  while (attemptedNode.size < nodes.length) {
    const target = await getHealthyNode(preferredNode, attemptedNode);

    if (!target.node) {
      return { status: 503, isReplica: false };
    }

    const url = buildNodeUrl(target.node, path);
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        return {
          status: response.status,
          isReplica: target.isReplica,
          node: target.node,
        };
      }

      const data = (await response.json()) as T;

      return {
        data,
        node: target.node,
        isReplica: target.isReplica,
        status: response.status,
      };
    } catch (error) {
      console.log(`Error forwarding request to node ${target.node.id}:`, error);
      attemptedNode.add(target.node.id);
      nodeHealthManager.setNodehealth(target.node.id, false);
    }
  }
  return { status: 503, isReplica: false };
};

app.get<{ Params: { key: string } }>("/cache/:key", async (request, reply) => {
  const { key } = request.params;
  const preferredNode = ring.getNode(key);

  if (!preferredNode) {
    return reply.status(404).send({ error: "No node found for the given key" });
  }

  const result = await forwardToHealthyNode<unknown>(
    preferredNode,
    `/cache/${key}`,
  );

  if (result.status >= 500 || result.status === 503) {
    return reply
      .status(result.status)
      .send({ error: "No healthy cache node available" });
  }

  if (result.data == undefined) {
    return reply
      .status(result.status)
      .send({ error: "Failed to fetch from cache node" });
  }

  if (result.isReplica) {
    return reply.status(200).send({
      message: `Primary cache node ${preferredNode.id} is down. Fetched from replicated server ${result.node?.id}`,
      source: result.node?.id,
      data: result.data,
    });
  }

  return reply.status(200).send(result.data);
});

app.post<{ Body: { key: string; value: unknown; ttl?: number } }>(
  "/cache/set",
  async (request, reply) => {
    const { key, value, ttl } = request.body;
    const preferredNode = ring.getNode(key);

    if (!preferredNode) {
      return reply
        .status(404)
        .send({ error: "No node found for the given key" });
    }

    const result = await forwardToHealthyNode<unknown>(
      preferredNode,
      "/cache/set",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value, ttl }),
      },
    );

    if (result.status >= 500 || result.status === 503) {
      return reply
        .status(result.status)
        .send({ error: "No healthy cache node available" });
    }

    if (result.data == undefined) {
      return reply
        .status(result.status)
        .send({ error: "Failed to set value on cache node" });
    }

    if (result.isReplica) {
      return reply.status(200).send({
        message: `Primary cache node ${preferredNode.id} is down. Write forwarded to replicated server ${result.node?.id}`,
        source: result.node?.id,
        data: result.data,
      });
    }

    return reply.status(200).send(result.data);
  },
);

app.delete<{ Params: { key: string } }>(
  "/cache/:key",
  async (request, reply) => {
    const { key } = request.params;
    const preferredNode = ring.getNode(key);

    if (!preferredNode) {
      return reply
        .status(404)
        .send({ error: "No node found for the given key" });
    }

    const result = await forwardToHealthyNode<unknown>(
      preferredNode,
      `/cache/${key}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      },
    );

    if (result.status >= 500 || result.status === 503) {
      return reply
        .status(result.status)
        .send({ error: "No healthy cache node available" });
    }

    if (result.data == undefined) {
      return reply
        .status(result.status)
        .send({ error: "Failed to delete value from cache node" });
    }

    if (result.isReplica) {
      return reply.status(200).send({
        message: `Primary cache node ${preferredNode.id} is down. Delete forwarded to replicated server ${result.node?.id}`,
        source: result.node?.id,
        data: result.data,
      });
    }

    return reply.status(200).send(result.data);
  },
);

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Coordinator started on port 3000");
  } catch (error) {
    console.error("Failed to start coordinator", error);
    process.exit(1);
  }
};

start();
