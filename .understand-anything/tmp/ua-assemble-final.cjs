#!/usr/bin/env node
const fs = require('fs');

const [graphPath, layersPath, tourPath, outputPath, commitHash, analyzedAt] = process.argv.slice(2);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));

const fileLevelTypes = new Set([
  'file',
  'config',
  'document',
  'service',
  'pipeline',
  'table',
  'schema',
  'resource',
  'endpoint',
]);
const nodeIds = new Set(graph.nodes.map((node) => node.id));
const fileNodeIds = new Set(
  graph.nodes.filter((node) => fileLevelTypes.has(node.type)).map((node) => node.id),
);

if (!Array.isArray(layers) || !Array.isArray(tour)) {
  throw new Error('layers and tour must be arrays');
}

const assigned = new Set();
for (const layer of layers) {
  for (const key of ['id', 'name', 'description', 'nodeIds']) {
    if (!(key in layer)) throw new Error(`layer missing ${key}`);
  }
  for (const id of layer.nodeIds) {
    if (!nodeIds.has(id)) throw new Error(`layer references missing node ${id}`);
    if (!fileNodeIds.has(id)) throw new Error(`layer references non-file node ${id}`);
    if (assigned.has(id)) throw new Error(`file node appears in multiple layers: ${id}`);
    assigned.add(id);
  }
}
for (const id of fileNodeIds) {
  if (!assigned.has(id)) throw new Error(`file node is not assigned to a layer: ${id}`);
}

tour.sort((a, b) => a.order - b.order);
tour.forEach((step, index) => {
  for (const key of ['order', 'title', 'description', 'nodeIds']) {
    if (!(key in step)) throw new Error(`tour step missing ${key}`);
  }
  if (step.order !== index + 1) throw new Error(`tour order is not sequential at ${step.title}`);
  for (const id of step.nodeIds) {
    if (!nodeIds.has(id)) throw new Error(`tour references missing node ${id}`);
  }
});

const output = {
  version: '1.0.0',
  project: {
    name: 'benebot',
    languages: ['css', 'javascript', 'json', 'jsonl', 'markdown', 'mts', 'typescript'],
    frameworks: ['Next.js', 'React', 'Tailwind CSS', 'Vitest'],
    description:
      'BeneBot is a synthetic-data medical-bill guide that separates historical EOB adjudication from current Stedi eligibility, supports bilingual Deepgram voice plus deterministic text fallback, and persists confirmed Medplum workflow artifacts.',
    analyzedAt,
    gitCommitHash: commitHash,
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers,
  tour,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
