export type CacheNode = {
  id: string;
  port: number;
  host: string;
};

export type RingPoint = {
  hash: number;
  node: CacheNode;
};

export function hashKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class ConsistentHashRing {
  private ring: RingPoint[] = [];
  private virtualNodes: number = 100;

  addNode(node: CacheNode): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNodeId = `${node.id}-${i}`;
      const virtualHash = hashKey(virtualNodeId);
      this.ring.push({ hash: virtualHash, node });
    }

    this.ring.sort((a, b) => a.hash - b.hash);
  }

  getNode(key: string): CacheNode | undefined {
    if (this.ring.length === 0) return undefined;

    const hash = hashKey(key);

    for (const point of this.ring) {
      if (hash <= point.hash) {
        return point.node;
      }
    }

    return this.ring[0]?.node;
  }
}

export class NodeHealthManager {
  private health = new Map<string, boolean>();

  setNodehealth(nodeId: string, isHealthy: boolean): void {
    this.health.set(nodeId, isHealthy);
  }

  getNodeHealth(nodeId: string): boolean | undefined {
    return this.health.get(nodeId);
  }
}
