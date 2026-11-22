(() => {
  'use strict';

  const externalRoads = new Set(['长江西路', '江山南路', '太行山路', '漓江西路', '滨海大道']);
  const footways = new Set(['footway', 'path', 'pedestrian', 'steps', 'living_street']);
  const vehicleRoads = new Set([
    'motorway', 'motorway_link', 'trunk', 'trunk_link',
    'primary', 'primary_link', 'secondary_link', 'tertiary_link',
  ]);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function canUse(road) {
    if (road.walkable === false || road.tunnel || road.layer < 0) return false;
    if (externalRoads.has(road.name) || road.name?.startsWith('珠江路')) return false;
    if (vehicleRoads.has(road.highway)) return false;
    // Elevated pedestrian structures need OSM nodes to establish where they meet
    // the ground network. Their geometrical crossings are not junctions.
    return (!(road.bridge || road.layer > 0) ||
      (footways.has(road.highway || road.kind) && road.nodeIds?.length === road.points.length));
  }

  function inBoundary(point, polygon, tolerance) {
    let inside = false;
    for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i++) {
      const [ax, ay] = polygon[previous];
      const [bx, by] = polygon[i];
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared) {
        const t = Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared));
        if (Math.hypot(point.x - ax - t * dx, point.y - ay - t * dy) <= tolerance) return true;
      }
      if ((ay > point.y) !== (by > point.y) && point.x < ax + (bx - ax) * (point.y - ay) / (by - ay)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function push(heap, entry) {
    let index = heap.length;
    heap.push(entry);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].cost <= entry.cost) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = entry;
  }

  function pop(heap) {
    const first = heap[0];
    const last = heap.pop();
    if (!heap.length) return first;
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
      if (heap[child].cost >= last.cost) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
    return first;
  }

  function shortestPath(nodes, start, goal) {
    const costs = new Float64Array(nodes.length).fill(Infinity);
    const preceding = new Int32Array(nodes.length).fill(-1);
    const heap = [{ index: start, cost: 0 }];
    costs[start] = 0;
    while (heap.length) {
      const { index, cost } = pop(heap);
      if (cost !== costs[index]) continue;
      if (index === goal) break;
      for (const edge of nodes[index].edges) {
        const next = cost + edge.cost;
        if (next >= costs[edge.index]) continue;
        costs[edge.index] = next;
        preceding[edge.index] = index;
        push(heap, { index: edge.index, cost: next });
      }
    }
    if (!Number.isFinite(costs[goal])) return null;
    const points = [];
    for (let index = goal; index !== -1; index = preceding[index]) {
      const { x, y } = nodes[index];
      points.push({ x, y });
    }
    return points.reverse();
  }

  function markComponents(nodes) {
    let component = 0;
    for (const node of nodes) {
      if (node.component !== -1 || !node.edges.length) continue;
      const pending = [node];
      node.component = component;
      while (pending.length) {
        for (const edge of pending.pop().edges) {
          const next = nodes[edge.index];
          if (next.component !== -1) continue;
          next.component = component;
          pending.push(next);
        }
      }
      component++;
    }
  }

  function build(world, blocked) {
    const units = world.geo.unitsPerMeter;
    const step = units * 6;
    const probe = units * 0.95;
    const nodes = [];
    const mappedVertices = new Map();

    function edgeClear(a, b) {
      const segments = Math.max(1, Math.ceil(distance(a, b) / probe));
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        if (blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
      }
      return true;
    }

    function addNode(x, y) {
      const node = { x, y, index: nodes.length, edges: [], component: -1 };
      nodes.push(node);
      return node;
    }

    function roadVertex(road, index) {
      const [x, y] = road.points[index];
      const osm = road.nodeIds?.[index];
      // Retain topology from OSM. Older records without node IDs may meet
      // at an exactly shared vertex on the same layer. Never merge crossings.
      const key = osm ? `osm:${osm}` : `vertex:${road.layer || 0}:${x},${y}`;
      if (mappedVertices.has(key)) return mappedVertices.get(key);
      const node = addNode(x, y);
      mappedVertices.set(key, node);
      return node;
    }

    function addRoad(road) {
      if (!canUse(road) || road.points.length < 2) return;
      const roadCost = footways.has(road.highway || road.kind) ? 1 : 1.16;
      let last = roadVertex(road, 0);
      for (let i = 1; i < road.points.length; i++) {
        const from = last;
        const to = roadVertex(road, i);
        const pieces = Math.max(1, Math.ceil(distance(from, to) / step));
        for (let j = 1; j <= pieces; j++) {
          const t = j / pieces;
          const next = j === pieces ? to : addNode(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
          if (last !== next && edgeClear(last, next)) {
            const cost = distance(last, next) * roadCost;
            last.edges.push({ index: next.index, cost });
            next.edges.push({ index: last.index, cost });
          }
          last = next;
        }
      }
    }

    for (const road of world.roads) addRoad(road);
    markComponents(nodes);
    const usable = nodes.filter(node => node.component !== -1);

    function findStart(start) {
      const candidates = usable.map(node => ({ node, gap: distance(start, node) }))
        .filter(candidate => candidate.gap <= units * 45)
        .sort((a, b) => a.gap - b.gap || a.node.index - b.node.index);
      return candidates.find(candidate => edgeClear(start, candidate.node))?.node;
    }

    function findDestination(target, component) {
      let closest;
      let best = units * 110;
      let nearestRoad = Infinity;
      for (const node of usable) {
        const gap = distance(target, node);
        nearestRoad = Math.min(nearestRoad, gap);
        if (node.component === component && gap < best) {
          best = gap;
          closest = node;
        }
      }
      // Keep the destination near its real frontage even when another graph
      // component is closer. This prevents an unreachable separated way from
      // reporting arrival on a different road at a distance.
      return best <= nearestRoad * 1.3 + units * 5 ? closest : undefined;
    }

    function route(start, target) {
      if (![start?.x, start?.y, target?.x, target?.y].every(Number.isFinite)) return null;
      if (!inBoundary(target, world.boundary, units)) return null;
      const from = findStart(start);
      if (!from) return null;
      const to = findDestination(target, from.component);
      if (!to) return null;
      return shortestPath(nodes, from.index, to.index);
    }

    function landing(target) {
      if (![target?.x, target?.y].every(Number.isFinite) || !inBoundary(target, world.boundary, units)) return null;
      const entrance = findStart(world.spawn);
      if (!entrance) return null;
      let closest = null;
      let gap = units * 110;
      for (const node of usable) {
        if (node.component !== entrance.component) continue;
        const separation = distance(target, node);
        if (separation < gap) {
          closest = node;
          gap = separation;
        }
      }
      return closest ? { x: closest.x, y: closest.y } : null;
    }

    return { route, landing };
  }

  window.PixelNavigation = { build };
})();
