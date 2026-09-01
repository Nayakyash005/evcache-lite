export type CacheNode = {
  id: string;
  port: number;
  host: string;
};

export type RingPoint = {
  hash: number; // the hash value (the starting point of the node as well)
  node: CacheNode; // the node that this points belongs to
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
    // const hash = hashKey(node.id);
    // this.ring.push({ hash, node });

    // rather then allocating a continous block to ndoe, we will allocate multiple virtual nodes to the node, this will help in better distribution of keys across nodes
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNodeId = `${node.id}-${i}`;
      const virtualHash = hashKey(virtualNodeId);
      this.ring.push({ hash: virtualHash, node });
    }

    this.ring.sort((a, b) => a.hash - b.hash);
  }

  getNode(key: string): CacheNode | undefined {
    if (this.ring.length === 0) return undefined;
    let hash = hashKey(key);
    for (let i = 0; i < this.ring.length; i++) {
      if (hash <= this.ring[i]!.hash) {
        return this.ring[i]!.node;
      }
    }

    //if we wrap aroud the circle when the hash is greater than all nodes
    return this.ring[0]?.node;
  }
}
