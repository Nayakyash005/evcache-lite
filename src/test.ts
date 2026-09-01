import { ConsistentHashRing, type CacheNode } from "./consistentHashRing.js";

const ring = new ConsistentHashRing();

const nodes: CacheNode[] = [
  {
    id: "node-1",
    host: "localhost",
    port: 3001,
  },
  {
    id: "node-2",
    host: "localhost",
    port: 3002,
  },
  {
    id: "node-3",
    host: "localhost",
    port: 3003,
  },
];

for (const node of nodes) {
  ring.addNode(node);
}

const distribution = new Map<string, number>();

for (const node of nodes) {
  distribution.set(node.id, 0);
}

for (let i = 1; i <= 10000; i++) {
  const key = `user:${i}`;
  const node = ring.getNode(key);
  if (i < 1023 && i > 1015) {
    console.log(`key: ${key} is mapped to node: ${node?.id}`);
  }
  if (node) {
    distribution.set(node.id, distribution.get(node.id)! + 1);
  }
}

console.log("Key distribution:");

for (const [nodeId, count] of distribution) {
  const percentage = (count / 10000) * 100;

  console.log(`${nodeId}: ${count} keys (${percentage.toFixed(2)}%)`);
}
