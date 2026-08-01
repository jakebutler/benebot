const fs = require("node:fs");
const path = require("node:path");

const root = "/Users/jacobbutler/Documents/benebot";
const batch = JSON.parse(fs.readFileSync(path.join(root, ".understand-anything/intermediate/batches.json"), "utf8"))
  .batches.find((candidate) => candidate.batchIndex === 2);
if (!batch) throw new Error("Batch 2 not found");

const nodes = [];
const edges = [];
const nodeIds = new Set();

function addNode(node) {
  if (nodeIds.has(node.id)) throw new Error(`Duplicate node: ${node.id}`);
  nodeIds.add(node.id);
  nodes.push(node);
}

function addEdge(source, target, type, weight) {
  if (source === target) throw new Error(`Self edge: ${source}`);
  edges.push({ source, target, type, direction: "forward", weight });
}

function addFile(filePath, summary, tags, complexity, languageNotes) {
  addNode({
    id: `file:${filePath}`,
    type: "file",
    name: path.basename(filePath),
    filePath,
    summary,
    tags,
    complexity,
    ...(languageNotes ? { languageNotes } : {}),
  });
}

function addSymbol(filePath, name, type, start, end, summary, tags, complexity = "simple", exported = false, languageNotes) {
  const id = `${type}:${filePath}:${name}`;
  addNode({
    id,
    type,
    name,
    filePath,
    lineRange: [start, end],
    summary,
    tags,
    complexity,
    ...(languageNotes ? { languageNotes } : {}),
  });
  addEdge(`file:${filePath}`, id, "contains", 1.0);
  if (exported) addEdge(`file:${filePath}`, id, "exports", 0.8);
}

addFile(
  "app/api/benebot/session/route.ts",
  "Creates a rate-limited synthetic BeneBot session for the fixed demo invoice, resolving Medplum seed identifiers when available and failing closed for configured-but-broken Medplum access.",
  ["api-handler", "session", "security", "medplum"],
  "moderate",
);
addSymbol("app/api/benebot/session/route.ts", "POST", "function", 22, 59, "Validates the fixed invoice request, resolves the signed session scope, mints a short-lived token, and returns only the synthetic patient and invoice bootstrap data.", ["api-handler", "session", "validation", "security"], "simple", true);

addFile(
  "app/api/deepgram-token/route.ts",
  "Issues a five-minute Deepgram temporary access token to an authenticated, rate-limited BeneBot session while keeping the long-lived Deepgram API key server-only.",
  ["api-handler", "deepgram", "voice", "security"],
  "simple",
);
addSymbol("app/api/deepgram-token/route.ts", "GET", "function", 14, 55, "Authenticates the BeneBot request, enforces a per-session voice-token limit, obtains a temporary Deepgram grant, and returns a sanitized fallback-friendly error on failure.", ["api-handler", "deepgram", "authentication", "rate-limiting"], "simple", true);

addFile(
  "app/api/tools/refresh-benefits/route.ts",
  "Refreshes current benefits through the guarded Stedi test provider, optionally persists the successful snapshot to Medplum, and returns a deterministic bilingual spoken summary distinct from historical claim data.",
  ["api-handler", "stedi", "medplum", "bilingual", "fallback"],
  "simple",
);
addSymbol("app/api/tools/refresh-benefits/route.ts", "POST", "function", 20, 51, "Authenticates the session, performs the fixed synthetic current-benefits check, records persistence warnings separately, and uses a visibly labeled fixture only when explicitly allowed.", ["api-handler", "eligibility", "validation", "fallback"], "simple", true);

addFile(
  "app/api/tools/request-followup/route.ts",
  "Creates a Medplum billing-review Task only after explicit patient confirmation, strict input validation, session-scope verification, and server confirmation of the persisted resource ID.",
  ["api-handler", "medplum", "patient-confirmation", "workflow"],
  "moderate",
);
addSymbol("app/api/tools/request-followup/route.ts", "POST", "function", 27, 66, "Rejects unconfirmed requests, validates a bounded billing issue summary and contact preference, then creates a scoped Medplum follow-up Task and reports its confirmed ID.", ["api-handler", "patient-confirmation", "medplum", "validation"], "simple", true);

addFile(
  "app/api/tools/save-summary/route.ts",
  "Persists a bounded conversation summary as a Medplum Communication, keeping language, answered questions, resources, follow-up, and unresolved issues structured without storing a transcript.",
  ["api-handler", "medplum", "summary", "privacy"],
  "simple",
);
addSymbol("app/api/tools/save-summary/route.ts", "POST", "function", 22, 43, "Authenticates and validates the summary payload, creates the scoped Communication, and returns success only after Medplum provides a resource ID.", ["api-handler", "medplum", "validation", "persistence"], "simple", true);

addFile(
  "app/api/tools/search-resources/route.ts",
  "Searches the local support-resource provider using only generic need and language filters so patient and claim data never leave BeneBot through resource discovery.",
  ["api-handler", "resource-search", "privacy", "bilingual"],
  "simple",
);
addSymbol("app/api/tools/search-resources/route.ts", "POST", "function", 20, 29, "Verifies the session, validates a generic resource need and English/Spanish language, and returns up to three local support resources.", ["api-handler", "resource-search", "privacy", "validation"], "simple", true);

addFile(
  "lib/env.ts",
  "Defines and validates server-only BeneBot configuration, constraining Stedi to its fixed test identifiers and exposing typed guards for Medplum, Deepgram, and Stedi credentials.",
  ["configuration", "validation", "server-only", "security"],
  "moderate",
  "Uses Zod defaults, literals, coercion, and inferred intersection return types to keep environment validation explicit and typed.",
);
addSymbol("lib/env.ts", "getEnv", "function", 35, 38, "Parses the process environment once and returns the cached typed BeneBot configuration.", ["configuration", "validation", "singleton"], "simple", true);
addSymbol("lib/env.ts", "requireMedplumEnv", "function", 40, 52, "Requires both Medplum client credentials and narrows the returned environment type for authenticated server use.", ["configuration", "medplum", "validation"], "simple", true);
addSymbol("lib/env.ts", "requireDeepgramEnv", "function", 54, 60, "Requires the server-side Deepgram API key and narrows the environment type before voice integration code uses it.", ["configuration", "deepgram", "validation"], "simple", true);
addSymbol("lib/env.ts", "requireStediEnv", "function", 62, 68, "Requires the Stedi test API key and returns a narrowed environment type for eligibility requests.", ["configuration", "stedi", "validation"], "simple", true);

addFile(
  "lib/errors.ts",
  "Centralizes typed BeneBot errors and sanitized HTTP responses, preserving intentional user-safe messages while logging unexpected failures only with an opaque request ID and error class.",
  ["error-handling", "security", "api-response", "logging"],
  "simple",
);
addSymbol("lib/errors.ts", "BeneBotError", "class", 1, 10, "Carries a stable public error code, safe message, and HTTP status for expected BeneBot failures.", ["error-handling", "data-model", "api-response"], "simple", true);
addSymbol("lib/errors.ts", "safeErrorResponse", "function", 12, 35, "Converts expected errors directly and unexpected errors into sanitized JSON with an opaque diagnostic request ID.", ["error-handling", "serialization", "security", "api-response"], "simple", true);

addFile(
  "lib/medplum/server.ts",
  "Provides the server-only Medplum client boundary, credential-state detection, client-credentials login, and a retry-safe cached client promise.",
  ["medplum", "server-only", "service", "authentication"],
  "simple",
);
addSymbol("lib/medplum/server.ts", "MedplumNotConfiguredError", "class", 7, 14, "Represents the explicit absence of Medplum client credentials so API routes can fail with a precise safe response.", ["medplum", "error-handling", "configuration"], "simple", true);
addSymbol("lib/medplum/server.ts", "isMedplumConfigured", "function", 18, 21, "Reports whether both Medplum client credentials are present without initiating a network connection.", ["medplum", "configuration", "utility"], "simple", true);
addSymbol("lib/medplum/server.ts", "connectMedplum", "function", 23, 34, "Creates a Medplum client and performs server-side client-credentials login, translating missing configuration to a domain error.", ["medplum", "authentication", "service"], "simple", false);
addSymbol("lib/medplum/server.ts", "getMedplumClient", "function", 36, 42, "Returns a shared asynchronous Medplum client and clears the cached promise after failed connection attempts so later calls may retry.", ["medplum", "singleton", "service"], "simple", true);

addFile(
  "lib/medplum/write-artifacts.ts",
  "Validates every FHIR reference against the signed session before idempotently creating Medplum Task, Communication, CoverageEligibilityRequest, and CoverageEligibilityResponse workflow artifacts.",
  ["medplum", "fhir-r4", "persistence", "security", "idempotency"],
  "complex",
  "Uses typed FHIR R4 resources and stable identifiers so writes are scoped, reference-safe, and idempotent.",
);
addSymbol("lib/medplum/write-artifacts.ts", "validateSessionReferences", "function", 21, 53, "Reads the signed session's patient, bill, coverage, encounter, EOB, provider, and payer resources and rejects any broken cross-resource binding before a write.", ["medplum", "validation", "authorization", "fhir-r4"], "simple", false);
addSymbol("lib/medplum/write-artifacts.ts", "createFollowupTask", "function", 59, 97, "Creates an idempotent requested FHIR Task containing only the confirmed issue summary, contact preference, and signed bill context, then requires a returned ID.", ["medplum", "fhir-r4", "workflow", "idempotency"], "simple", true);
addSymbol("lib/medplum/write-artifacts.ts", "buildSummary", "function", 99, 114, "Builds a bounded summary that explicitly labels the historical EOB date separately from the latest eligibility status and records no full transcript.", ["summary", "privacy", "serialization", "historical-current-separation"], "simple", false);
addSymbol("lib/medplum/write-artifacts.ts", "createConversationCommunication", "function", 116, 178, "Validates session and optional follow-up Task scope, then idempotently persists a completed FHIR Communication linking the bill, EOB, encounter, and confirmed Task.", ["medplum", "fhir-r4", "summary", "idempotency"], "moderate", true);
addSymbol("lib/medplum/write-artifacts.ts", "eligibilityItems", "function", 180, 214, "Deterministically maps only known deductible, out-of-pocket, copay, and coinsurance values into FHIR eligibility insurance items.", ["fhir-r4", "eligibility", "serialization", "deterministic"], "simple", false);
addSymbol("lib/medplum/write-artifacts.ts", "persistEligibilityResult", "function", 216, 276, "Skips fixture data and idempotently records live eligibility request and response resources tied to the signed patient, coverage, provider, and payer context.", ["medplum", "fhir-r4", "eligibility", "idempotency"], "moderate", true);

addFile(
  "lib/session.ts",
  "Implements signed, short-lived BeneBot JWT sessions bound to one synthetic patient, invoice, EOB, coverage, encounter, provider, and payer, plus bearer parsing and in-memory demo rate limiting.",
  ["session", "jwt", "authorization", "rate-limiting", "security"],
  "moderate",
  "Uses JOSE HS256 verification with fixed issuer, audience, algorithm, token type, and Zod claim validation before accepting browser requests.",
);
addSymbol("lib/session.ts", "getSessionSecret", "function", 71, 81, "Loads the session signing secret and rejects missing or shorter-than-32-byte values before any JWT operation.", ["session", "security", "validation"], "simple", false);
addSymbol("lib/session.ts", "createBeneBotSession", "function", 83, 113, "Validates a bounded TTL, binds the full bill scope into claims, and signs a short-lived HS256 JWT with a unique token ID.", ["session", "jwt", "security", "factory"], "simple", true);
addSymbol("lib/session.ts", "verifyBeneBotSession", "function", 115, 145, "Verifies signature, algorithm, issuer, audience, token type, expiry, and every required bill-scope claim before returning a session.", ["session", "jwt", "authorization", "validation"], "simple", true);
addSymbol("lib/session.ts", "getBearerToken", "function", 147, 158, "Extracts exactly one bearer token from the Authorization header and raises a safe authentication error otherwise.", ["session", "authentication", "validation"], "simple", true);
addSymbol("lib/session.ts", "verifyRequestSession", "function", 160, 164, "Combines bearer extraction with full BeneBot JWT verification for server route handlers.", ["session", "authentication", "authorization"], "simple", true);
addSymbol("lib/session.ts", "enforceDemoRateLimit", "function", 173, 192, "Applies a bounded in-memory fixed-window request limit and emits a safe retry-later error when the demo limit is exceeded.", ["rate-limiting", "security", "validation"], "simple", true);

addFile(
  "lib/stedi/eligibility.ts",
  "Guards the fixed Jane Doe Stedi test request, normalizes only unambiguous payer fields, performs the sole permitted deductible derivation in deterministic code, and produces timestamped English/Spanish spoken summaries.",
  ["stedi", "eligibility", "deterministic", "bilingual", "validation"],
  "complex",
  "Zod passthrough schemas preserve tolerance for payer payload additions while explicit extraction leaves omitted or ambiguous benefit values unknown.",
);
addSymbol("lib/stedi/eligibility.ts", "spokenSource", "function", 48, 65, "Produces an English or Spanish source label that clearly distinguishes live Stedi, Medplum-bot test, and non-live fixture data.", ["bilingual", "voice", "eligibility", "source-labeling"], "simple", false);
addSymbol("lib/stedi/eligibility.ts", "spokenCheckedAt", "function", 67, 79, "Formats an eligibility snapshot timestamp in English or Spanish with an explicit UTC time zone.", ["bilingual", "voice", "date-formatting"], "simple", false);
addSymbol("lib/stedi/eligibility.ts", "spokenMoney", "function", 81, 91, "Formats a known USD amount for English or Spanish speech while rendering omitted values as not returned.", ["bilingual", "voice", "money-formatting", "unknown-preservation"], "simple", false);
addSymbol("lib/stedi/eligibility.ts", "buildCurrentBenefitsSpokenSummary", "function", 93, 107, "Builds deterministic English and Spanish voice text that timestamps current eligibility and explicitly states it cannot explain, validate, or replace the historical claim.", ["bilingual", "voice", "eligibility", "historical-current-separation"], "simple", true);
addSymbol("lib/stedi/eligibility.ts", "deriveDeductibleSummary", "function", 180, 209, "Subtracts remaining from annual deductible only when both nonnegative values share the exact benefit level, network, and service scope; otherwise it preserves known inputs without derivation.", ["deterministic", "financial-calculation", "validation", "eligibility"], "simple", true);
addSymbol("lib/stedi/eligibility.ts", "scopedAmount", "function", 211, 228, "Converts an individual benefit amount into a normalized value paired with explicit network and service-type scope.", ["eligibility", "normalization", "validation"], "simple", false);
addSymbol("lib/stedi/eligibility.ts", "exactScopedAmount", "function", 230, 253, "Selects exactly one individual in-network service-type-30 annual or remaining benefit, returning unknown when payer scope is ambiguous.", ["eligibility", "normalization", "unknown-preservation"], "simple", false);
addSymbol("lib/stedi/eligibility.ts", "assertStediTestIdentity", "function", 272, 281, "Fails before networking unless the entire request exactly matches the fixed synthetic Jane Doe identity and documented Stedi test literals.", ["stedi", "security", "validation", "synthetic-data"], "simple", true);
addSymbol("lib/stedi/eligibility.ts", "normalizeStediResponse", "function", 287, 371, "Parses a Stedi response and emits only clearly supported coverage, deductible, out-of-pocket, copay, and coinsurance fields with warnings for missing or ambiguous scope.", ["stedi", "normalization", "validation", "unknown-preservation"], "moderate", true);
addSymbol("lib/stedi/eligibility.ts", "loadFixtureFallback", "function", 373, 375, "Returns the captured normalized fallback fixture whose source and warnings visibly mark it as non-live.", ["fixture", "fallback", "eligibility", "source-labeling"], "simple", true);
addSymbol("lib/stedi/eligibility.ts", "DirectStediTestProvider", "class", 377, 411, "Implements the direct Stedi test call with preflight identity enforcement, API-key authentication, timeout cancellation, response normalization, and sanitized failures.", ["stedi", "service", "security", "timeout"], "simple", true);
addSymbol("lib/stedi/eligibility.ts", "createEligibilityProvider", "function", 413, 427, "Selects the direct test provider only when a Stedi test key is configured and rejects unsupported provider modes.", ["stedi", "factory", "configuration", "service"], "simple", true);

addFile(
  "tests/integration/medplum-billing-case.test.ts",
  "Integration tests prove that billing-review Tasks contain only confirmed scoped fields, omit transcripts, and are never written when the EOB-to-encounter relationship violates the signed session.",
  ["test", "integration-test", "medplum", "security", "privacy"],
  "moderate",
);
addSymbol("tests/integration/medplum-billing-case.test.ts", "scopedResources", "function", 19, 74, "Builds the minimal linked FHIR resource fixture used to exercise session-bound Medplum write validation.", ["test", "fixture", "fhir-r4"], "moderate", false);

addFile(
  "tests/stedi-eligibility.test.ts",
  "Tests the fixed-identity pre-network guard, literal Stedi request, conservative benefit normalization, scope-safe deductible derivation, bilingual historical/current disclaimer, and visibly non-live fixture fallback.",
  ["test", "stedi", "eligibility", "deterministic", "bilingual"],
  "moderate",
);

addFile(
  "tests/unit/session.test.ts",
  "Unit tests cover valid bill-scoped sessions and reject tampered, expired, wrong-audience, or incomplete JWTs.",
  ["test", "unit-test", "session", "jwt", "security"],
  "moderate",
);

for (const file of batch.files) {
  for (const importedPath of batch.batchImportData[file.path] || []) {
    addEdge(`file:${file.path}`, `file:${importedPath}`, "imports", 0.7);
  }
}

const calls = [
  ["function:app/api/benebot/session/route.ts:POST", "function:lib/session.ts:createBeneBotSession"],
  ["function:app/api/benebot/session/route.ts:POST", "function:lib/session.ts:enforceDemoRateLimit"],
  ["function:app/api/deepgram-token/route.ts:GET", "function:lib/session.ts:verifyRequestSession"],
  ["function:app/api/deepgram-token/route.ts:GET", "function:lib/session.ts:enforceDemoRateLimit"],
  ["function:app/api/tools/refresh-benefits/route.ts:POST", "function:lib/stedi/eligibility.ts:createEligibilityProvider"],
  ["function:app/api/tools/refresh-benefits/route.ts:POST", "function:lib/medplum/write-artifacts.ts:persistEligibilityResult"],
  ["function:app/api/tools/refresh-benefits/route.ts:POST", "function:lib/stedi/eligibility.ts:buildCurrentBenefitsSpokenSummary"],
  ["function:app/api/tools/refresh-benefits/route.ts:POST", "function:lib/stedi/eligibility.ts:loadFixtureFallback"],
  ["function:app/api/tools/refresh-benefits/route.ts:POST", "function:lib/session.ts:verifyRequestSession"],
  ["function:app/api/tools/request-followup/route.ts:POST", "function:lib/medplum/write-artifacts.ts:createFollowupTask"],
];
for (const [source, target] of calls) addEdge(source, target, "calls", 0.8);

addEdge("file:lib/medplum/write-artifacts.ts", "file:tests/integration/medplum-billing-case.test.ts", "tested_by", 0.5);
addEdge("file:lib/stedi/eligibility.ts", "file:tests/stedi-eligibility.test.ts", "tested_by", 0.5);
addEdge("file:lib/session.ts", "file:tests/unit/session.test.ts", "tested_by", 0.5);

const expectedFiles = new Set(batch.files.map((file) => file.path));
const emittedFiles = new Set(nodes.filter((node) => node.type === "file").map((node) => node.filePath));
for (const filePath of expectedFiles) {
  if (!emittedFiles.has(filePath)) throw new Error(`Missing file node: ${filePath}`);
}

const expectedImports = Object.values(batch.batchImportData).reduce((sum, imports) => sum + imports.length, 0);
const actualImports = edges.filter((edge) => edge.type === "imports").length;
if (expectedImports !== actualImports) {
  throw new Error(`Import edge mismatch: expected ${expectedImports}, got ${actualImports}`);
}
if (nodes.length > 60 || edges.length > 120) {
  throw new Error(`Batch requires splitting: ${nodes.length} nodes, ${edges.length} edges`);
}

const allowedExternalFileTargets = new Set([
  ...Object.values(batch.batchImportData).flat().map((filePath) => `file:${filePath}`),
  ...Object.values(batch.neighborMap || {}).flat().map((neighbor) => `file:${neighbor.path}`),
]);
for (const edge of edges) {
  if (!nodeIds.has(edge.source)) throw new Error(`Unknown edge source: ${edge.source}`);
  if (!nodeIds.has(edge.target) && !allowedExternalFileTargets.has(edge.target)) {
    throw new Error(`Unknown edge target: ${edge.target}`);
  }
}

const output = path.join(root, ".understand-anything/intermediate/batch-2.json");
fs.writeFileSync(output, `${JSON.stringify({ nodes, edges }, null, 2)}\n`);
process.stdout.write(JSON.stringify({ output, nodes: nodes.length, edges: edges.length, imports: actualImports }));
