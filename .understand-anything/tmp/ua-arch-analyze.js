#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const [inputPath, outputPath] = process.argv.slice(2);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function groupForPath(filePath, commonPrefix) {
  const relative = commonPrefix && filePath.startsWith(commonPrefix)
    ? filePath.slice(commonPrefix.length)
    : filePath;
  const parts = relative.split("/").filter(Boolean);
  if (parts.length > 1) return parts[0];
  if (/\.(test|spec)\.[^.]+$/i.test(relative) || /(^test_|_test\.)/i.test(relative)) return "test";
  if (/\.config\.|^(package|tsconfig|next\.config|postcss\.config|eslint\.config)/i.test(relative)) return "config";
  return "root";
}

function commonDirectoryPrefix(paths) {
  if (!paths.length) return "";
  const dirs = paths.map((value) => value.split("/").slice(0, -1));
  const prefix = [];
  for (let index = 0; index < Math.min(...dirs.map((parts) => parts.length)); index += 1) {
    const segment = dirs[0][index];
    if (!dirs.every((parts) => parts[index] === segment)) break;
    prefix.push(segment);
  }
  return prefix.length ? `${prefix.join("/")}/` : "";
}

function patternFor(group, filePaths) {
  const patterns = [
    [/^(routes|api|controllers|endpoints|handlers|serializers|controller|routers)$/i, "api"],
    [/^(services|core|lib|domain|logic|internal|signals|mailers|jobs|channels|composables)$/i, "service"],
    [/^(models|db|data|persistence|repository|entities|entity|migrations|sql|database|schema)$/i, "data"],
    [/^(components|views|pages|ui|layouts|screens|app)$/i, "ui"],
    [/^(middleware|plugins|interceptors|guards)$/i, "middleware"],
    [/^(utils|helpers|common|shared|tools|pkg|templatetags)$/i, "utility"],
    [/^(config|constants|env|settings|management|commands)$/i, "config"],
    [/^(__tests__|test|tests|spec|specs|src\/test\/java)$/i, "test"],
    [/^(types|interfaces|schemas|contracts|dtos|dto|request|response)$/i, "types"],
    [/^hooks$/i, "hooks"],
    [/^(store|state|reducers|actions|slices)$/i, "state"],
    [/^(assets|static|public)$/i, "assets"],
    [/^(cmd|bin)$/i, "entry"],
    [/^(docs|documentation|wiki)$/i, "documentation"],
    [/^(deploy|deployment|infra|infrastructure|k8s|kubernetes|helm|charts|terraform|tf|docker)$/i, "infrastructure"],
    [/^(\.github|\.gitlab|\.circleci)$/i, "ci-cd"],
  ];
  for (const [regex, label] of patterns) if (regex.test(group)) return label;
  const joined = filePaths.join("\n");
  if (/\.(test|spec)\.[^.]+$/im.test(joined) || /(^|\/)(test_|[^/]+_test\.)/im.test(joined)) return "test";
  if (/\.d\.ts$/im.test(joined)) return "types";
  if (/(^|\/)(Dockerfile|docker-compose\.|Makefile)/im.test(joined) || /\.(tf|tfvars)$/im.test(joined)) return "infrastructure";
  if (/(^|\/)\.github\/workflows\//im.test(joined) || /Jenkinsfile|\.gitlab-ci\.yml/im.test(joined)) return "ci-cd";
  if (/\.(md|rst)$/im.test(joined)) return "documentation";
  if (/\.(sql)$/im.test(joined)) return "data";
  if (/\.(graphql|gql|proto)$/im.test(joined)) return "types";
  return "unclassified";
}

try {
  if (!inputPath || !outputPath) fail("Usage: ua-arch-analyze.js <input.json> <output.json>");
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const fileNodes = Array.isArray(input.fileNodes) ? input.fileNodes : [];
  const importEdges = Array.isArray(input.importEdges) ? input.importEdges : [];
  const allEdges = Array.isArray(input.allEdges) ? input.allEdges : [];
  const nodeById = new Map(fileNodes.map((node) => [node.id, node]));
  const paths = fileNodes.map((node) => node.filePath || node.name || node.id);
  const commonPrefix = commonDirectoryPrefix(paths);
  const fileGroup = new Map();
  const directoryGroups = {};
  for (const node of fileNodes) {
    const group = groupForPath(node.filePath || node.name || node.id, commonPrefix);
    fileGroup.set(node.id, group);
    (directoryGroups[group] ||= []).push(node.id);
  }

  const nodeTypeGroups = {};
  for (const node of fileNodes) (nodeTypeGroups[node.type] ||= []).push(node.id);

  const fileFanIn = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const fileFanOut = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const adjacency = Object.fromEntries(fileNodes.map((node) => [node.id, []]));
  const groupImports = Object.fromEntries(Object.keys(directoryGroups).map((group) => [group, { importsFrom: [], importedBy: [] }]));
  const interCounts = new Map();
  const groupInvolving = Object.fromEntries(Object.keys(directoryGroups).map((group) => [group, 0]));
  const groupInternal = Object.fromEntries(Object.keys(directoryGroups).map((group) => [group, 0]));
  for (const edge of importEdges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    fileFanOut[edge.source] += 1;
    fileFanIn[edge.target] += 1;
    adjacency[edge.source].push(edge.target);
    const from = fileGroup.get(edge.source);
    const to = fileGroup.get(edge.target);
    groupInvolving[from] += 1;
    if (to !== from) groupInvolving[to] += 1;
    if (from === to) groupInternal[from] += 1;
    else interCounts.set(`${from}\u0000${to}`, (interCounts.get(`${from}\u0000${to}`) || 0) + 1);
  }
  const interGroupImports = [...interCounts].map(([key, count]) => {
    const [from, to] = key.split("\u0000");
    return { from, to, count };
  }).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  for (const item of interGroupImports) {
    groupImports[item.from].importsFrom.push(item.to);
    groupImports[item.to].importedBy.push(item.from);
  }
  for (const data of Object.values(groupImports)) {
    data.importsFrom = [...new Set(data.importsFrom)].sort();
    data.importedBy = [...new Set(data.importedBy)].sort();
  }

  const crossCounts = new Map();
  const nonCodeConnections = [];
  for (const edge of allEdges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const key = `${source.type}\u0000${target.type}\u0000${edge.type}`;
    crossCounts.set(key, (crossCounts.get(key) || 0) + 1);
    if (source.type !== "file" || target.type !== "file") {
      nonCodeConnections.push({ source: source.id, target: target.id, edgeType: edge.type });
    }
  }
  const crossCategoryEdges = [...crossCounts].map(([key, count]) => {
    const [fromType, toType, edgeType] = key.split("\u0000");
    return { fromType, toType, edgeType, count };
  }).sort((a, b) => b.count - a.count);

  const intraGroupDensity = {};
  const patternMatches = {};
  for (const [group, ids] of Object.entries(directoryGroups)) {
    const totalEdges = groupInvolving[group];
    intraGroupDensity[group] = {
      internalEdges: groupInternal[group],
      totalEdges,
      density: totalEdges ? Number((groupInternal[group] / totalEdges).toFixed(4)) : 0,
    };
    patternMatches[group] = patternFor(group, ids.map((id) => nodeById.get(id).filePath || ""));
  }

  const reverseCount = (from, to) => interCounts.get(`${to}\u0000${from}`) || 0;
  const dependencyDirection = interGroupImports
    .filter(({ from, to, count }) => count > reverseCount(from, to))
    .map(({ from, to, count }) => ({ dependent: from, dependsOn: to, count, reverseCount: reverseCount(from, to) }));

  const lowerPaths = paths.map((value) => value.toLowerCase());
  const infraFiles = paths.filter((value) => /(^|\/)(dockerfile|docker-compose[^/]*|makefile)$|(^|\/)\.github\/workflows\/|\.gitlab-ci\.yml$|jenkinsfile$|\.(tf|tfvars)$|(^|\/)(k8s|kubernetes|helm|charts)\//i.test(value));
  const deploymentTopology = {
    hasDockerfile: lowerPaths.some((value) => /(^|\/)dockerfile$/.test(value)),
    hasCompose: lowerPaths.some((value) => /(^|\/)docker-compose/.test(value)),
    hasK8s: lowerPaths.some((value) => /(^|\/)(k8s|kubernetes|helm|charts)\//.test(value)),
    hasTerraform: lowerPaths.some((value) => /\.(tf|tfvars)$/.test(value)),
    hasCI: lowerPaths.some((value) => /(^|\/)\.github\/workflows\/|\.gitlab-ci\.yml$|jenkinsfile$/.test(value)),
    infraFiles,
  };
  const dataPipeline = {
    schemaFiles: paths.filter((value) => /\.(sql|graphql|gql|proto|prisma)$|(^|\/)schema[^/]*\./i.test(value)),
    migrationFiles: paths.filter((value) => /(^|\/)migrations?\//i.test(value)),
    dataModelFiles: paths.filter((value) => /(^|\/)(models?|entities|types|fixtures|data)\//i.test(value)),
    apiHandlerFiles: paths.filter((value) => /(^|\/)app\/api\/.*\/route\.[jt]sx?$|(^|\/)(routes|controllers|handlers|endpoints)\//i.test(value)),
  };

  const docs = fileNodes.filter((node) => node.type === "document");
  const documentedGroups = new Set();
  for (const doc of docs) {
    const docPath = doc.filePath || "";
    const docGroup = fileGroup.get(doc.id);
    documentedGroups.add(docGroup);
    const text = `${doc.summary || ""} ${(doc.tags || []).join(" ")} ${docPath}`.toLowerCase();
    for (const group of Object.keys(directoryGroups)) if (text.includes(group.toLowerCase())) documentedGroups.add(group);
  }
  const groups = Object.keys(directoryGroups);
  const docCoverage = {
    groupsWithDocs: documentedGroups.size,
    totalGroups: groups.length,
    coverageRatio: groups.length ? Number((documentedGroups.size / groups.length).toFixed(4)) : 0,
    undocumentedGroups: groups.filter((group) => !documentedGroups.has(group)),
  };

  const result = {
    scriptCompleted: true,
    commonPrefix,
    directoryGroups,
    nodeTypeGroups,
    importAdjacency: adjacency,
    groupImports,
    crossCategoryEdges,
    nonCodeConnections,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup: Object.fromEntries(Object.entries(directoryGroups).map(([group, ids]) => [group, ids.length])),
      nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypeGroups).map(([type, ids]) => [type, ids.length])),
    },
    fileFanIn,
    fileFanOut,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
} catch (error) {
  fail(error instanceof Error ? error.stack || error.message : String(error));
}
