import type { WorldMap, RouteNode } from "../types";

/** Get the nodes available to vote on (connections from current node) */
export function getAvailableNodes(map: WorldMap): RouteNode[] {
  const current = map.nodes[map.currentNodeId];
  return current.connections.map(id => map.nodes[id]);
}

/** Mark a node as visited and set it as current */
export function advanceToNode(map: WorldMap, nodeId: string): WorldMap {
  const node = map.nodes[nodeId];
  if (!node) return map;

  return {
    ...map,
    currentNodeId: nodeId,
    nodes: {
      ...map.nodes,
      [nodeId]: { ...node, visited: true },
    },
  };
}
