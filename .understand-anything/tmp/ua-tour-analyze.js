#!/usr/bin/env node

const fs = require("node:fs");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  fail("Usage: node ua-tour-analyze.js <input.json> <output.json>");
}

try {
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const layers = Array.isArray(input.layers) ? input.layers : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fanIn = new Map(nodes.map((node) => [node.id, 0]));
  const fanOut = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (fanIn.has(edge.target)) fanIn.set(edge.target, fanIn.get(edge.target) + 1);
    if (fanOut.has(edge.source)) fanOut.set(edge.source, fanOut.get(edge.source) + 1);
  }

  const ranked = (counts, key) => [...counts.entries()]
    .map(([id, count]) => ({ id, [key]: count, name: nodeById.get(id)?.name ?? id }))
    .sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id))
    .slice(0, 20);

  const fanInRanking = ranked(fanIn, "fanIn");
  const fanOutRanking = ranked(fanOut, "fanOut");
  const fanOutValues = [...fanOut.values()].sort((a, b) => b - a);
  const highFanOutCutoff = fanOutValues[Math.max(0, Math.ceil(nodes.length * 0.1) - 1)] ?? Infinity;
  const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
  const lowFanInCutoff = fanInValues[Math.max(0, Math.ceil(nodes.length * 0.25) - 1)] ?? -1;
  const entryNames = new Set([
    "index.ts", "index.js", "main.ts", "main.js", "app.ts", "app.js", "server.ts", "server.js",
    "mod.rs", "main.go", "main.py", "main.rs", "manage.py", "app.py", "wsgi.py", "asgi.py",
    "run.py", "__main__.py", "Application.java", "Main.java", "Program.cs", "config.ru", "index.php",
    "App.swift", "Application.kt", "main.cpp", "main.c",
  ]);

  const entryPointCandidates = nodes
    .map((node) => {
      const path = node.filePath ?? "";
      const name = path.split("/").at(-1) ?? node.name ?? "";
      let score = 0;
      if (node.type === "document") {
        if (path === "README.md") score += 5;
        else if (!path.includes("/") && path.toLowerCase().endsWith(".md")) score += 2;
      } else {
        if (entryNames.has(name)) score += 3;
        if (path.split("/").length <= 2) score += 1;
        if ((fanOut.get(node.id) ?? 0) >= highFanOutCutoff) score += 1;
        if ((fanIn.get(node.id) ?? 0) <= lowFanInCutoff) score += 1;
      }
      return { id: node.id, score, name: node.name, summary: node.summary };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5);

  const codeStart = entryPointCandidates.find((candidate) => nodeById.get(candidate.id)?.type !== "document")
    ?? nodes.find((node) => node.type === "file");
  const startId = codeStart?.id ?? null;
  const traversable = new Map();
  for (const edge of edges) {
    if ((edge.type === "imports" || edge.type === "calls") && nodeById.has(edge.source) && nodeById.has(edge.target)) {
      if (!traversable.has(edge.source)) traversable.set(edge.source, []);
      traversable.get(edge.source).push(edge.target);
    }
  }

  const order = [];
  const depthMap = {};
  const byDepth = {};
  if (startId) {
    const queue = [startId];
    depthMap[startId] = 0;
    while (queue.length) {
      const current = queue.shift();
      const depth = depthMap[current];
      order.push(current);
      if (!byDepth[depth]) byDepth[depth] = [];
      byDepth[depth].push(current);
      for (const next of traversable.get(current) ?? []) {
        if (depthMap[next] !== undefined) continue;
        depthMap[next] = depth + 1;
        queue.push(next);
      }
    }
  }

  const inventoryItem = (node) => ({ id: node.id, name: node.name, type: node.type, summary: node.summary });
  const nonCodeFiles = {
    documentation: nodes.filter((node) => node.type === "document").map(inventoryItem),
    infrastructure: nodes.filter((node) => ["service", "pipeline", "resource"].includes(node.type)).map(inventoryItem),
    data: nodes.filter((node) => ["table", "schema", "endpoint"].includes(node.type)).map(inventoryItem),
    config: nodes.filter((node) => node.type === "config").map(inventoryItem),
  };

  const relationshipTypes = new Set(["imports", "calls"]);
  const directed = new Set(edges.filter((edge) => relationshipTypes.has(edge.type)).map((edge) => `${edge.source}\u0000${edge.target}`));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    if (!relationshipTypes.has(edge.type)) continue;
    if (directed.has(`${edge.target}\u0000${edge.source}`)) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }
  }

  const clusters = [];
  const seenClusterKeys = new Set();
  for (const [id, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      let members = new Set([id, neighbor]);
      let changed = true;
      while (changed && members.size < 5) {
        changed = false;
        for (const candidate of nodes.map((node) => node.id)) {
          if (members.has(candidate)) continue;
          const links = [...members].filter((member) => adjacency.get(candidate)?.has(member)).length;
          if (links >= 2) {
            members.add(candidate);
            changed = true;
            if (members.size === 5) break;
          }
        }
      }
      const memberList = [...members].sort();
      const key = memberList.join("|");
      if (seenClusterKeys.has(key)) continue;
      seenClusterKeys.add(key);
      const edgeCount = edges.filter((edge) => members.has(edge.source) && members.has(edge.target)).length;
      clusters.push({ nodes: memberList, edgeCount });
    }
  }
  clusters.sort((a, b) => b.edgeCount - a.edgeCount || b.nodes.length - a.nodes.length);

  const nodeSummaryIndex = Object.fromEntries(nodes.map((node) => [
    node.id,
    { name: node.name, type: node.type, summary: node.summary },
  ]));

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: { startNode: startId, order, depthMap, byDepth },
    nonCodeFiles,
    clusters: clusters.slice(0, 10),
    layers: {
      count: layers.length,
      list: layers.map(({ id, name, description }) => ({ id, name, description })),
    },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
}
