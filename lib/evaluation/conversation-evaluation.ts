import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/**
 * Evaluation-only contracts for the adjudicated gold packet. Nothing in this
 * module is imported by the patient runtime; callers must opt in to loading a
 * packet from disk for review or test work.
 */

export const RUBRIC_IDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"] as const;

export type RubricId = (typeof RUBRIC_IDS)[number];

/**
 * The P0 run record follows the approved reliability plan, not the incoming
 * research packet. The packet's similarly numbered rubrics are validated and
 * reported below, but are never promoted to runtime evaluation criteria.
 */
export const EXECUTABLE_RUBRICS = [
  {
    id: "R1",
    name: "Session language and voice consistency",
    description:
      "The language is selected before connection, the native TTS voice matches it, and the session stays in that language.",
    priority: 1,
  },
  {
    id: "R2",
    name: "Authenticated context, privacy, and scope",
    description:
      "The secure portal provides only the bound billing context; BeneBot neither requests identifiers again nor accesses unrelated chart data.",
    priority: 2,
  },
  {
    id: "R3",
    name: "Tool-before-claim grounding",
    description:
      "Each patient-specific claim is preceded by its required successful tool call in the current session.",
    priority: 3,
  },
  {
    id: "R4",
    name: "Historical bill factuality and no model math",
    description:
      "Historical explanations use reconciled EOB values only, avoid model-derived arithmetic, and describe processing rather than proof of correctness.",
    priority: 4,
  },
  {
    id: "R5",
    name: "Current benefits and temporal separation",
    description:
      "Current benefits include their source and timestamp and remain explicitly separate from historical adjudication.",
    priority: 5,
  },
  {
    id: "R6",
    name: "Plain-language explanation and analogy safety",
    description:
      "The response is concise in the selected language and any approved analogy is number-free and includes its limitation.",
    priority: 6,
  },
  {
    id: "R7",
    name: "Uncertainty handling and out-of-scope refusal",
    description:
      "Unknowns remain unknown, discrepancies are not invented, and chart or medical questions receive a helpful scoped refusal.",
    priority: 7,
  },
  {
    id: "R8",
    name: "Confirmation, external-action truthfulness, and persistence",
    description:
      "A billing-review case is created only after confirmation, success follows a confirmed ID, and only concise structured summaries persist.",
    priority: 8,
  },
] as const;

const rubricDefinitionSchema = z
  .object({
    id: z.enum(RUBRIC_IDS),
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    priority: z.number().int().min(1).max(8),
  })
  .strict();

export const eightRubricSpecSchema = z
  .object({ rubrics: z.array(rubricDefinitionSchema).length(RUBRIC_IDS.length) })
  .strict()
  .superRefine((spec, context) => {
    const seen = new Set<string>();
    for (const rubric of spec.rubrics) {
      if (seen.has(rubric.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rubric ${rubric.id} is duplicated.`,
          path: ["rubrics"],
        });
      }
      seen.add(rubric.id);
    }
    for (const expectedId of RUBRIC_IDS) {
      if (!seen.has(expectedId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required rubric ${expectedId}.`,
          path: ["rubrics"],
        });
      }
    }
  });

export type EightRubricSpec = z.infer<typeof eightRubricSpecSchema>;

export interface ResearchRubricConflict {
  rubricId: RubricId;
  executable: (typeof EXECUTABLE_RUBRICS)[number];
  research: EightRubricSpec["rubrics"][number];
}

export function findResearchRubricConflicts(
  researchRubrics: EightRubricSpec,
): ResearchRubricConflict[] {
  return EXECUTABLE_RUBRICS.flatMap((executable) => {
    const research = researchRubrics.rubrics.find((rubric) => rubric.id === executable.id);
    if (
      research &&
      (research.name !== executable.name ||
        research.description !== executable.description ||
        research.priority !== executable.priority)
    ) {
      return [{ rubricId: executable.id, executable, research }];
    }
    return [];
  });
}

const nonEmptyText = z.string().trim().min(1);

export const transcriptEvalCaseSchema = z
  .object({
    caseId: z.string().regex(/^[a-z0-9-]+$/, "caseId must be a stable lowercase slug."),
    language: z.enum(["en", "es"]),
    conceptIds: z.array(nonEmptyText).min(1),
    patientState: nonEmptyText,
    utterance: nonEmptyText,
    asrVariant: nonEmptyText,
    expectedResponseType: z.enum([
      "generic-concept",
      "historical-bill",
      "current-benefits",
      "historical-current-comparison",
      "scoped-refusal",
      "prepare-followup",
      "confirm-followup",
    ]),
    requiredToolCalls: z.array(nonEmptyText),
    forbiddenToolCalls: z.array(nonEmptyText),
    requiredResponseElements: z.array(nonEmptyText),
    forbiddenClaims: z.array(nonEmptyText),
    idealFollowupQuestion: nonEmptyText,
  })
  .strict()
  .superRefine((testCase, context) => {
    if (new Set(testCase.conceptIds).size !== testCase.conceptIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conceptIds must not repeat a concept.",
        path: ["conceptIds"],
      });
    }

    const forbidden = new Set(testCase.forbiddenToolCalls);
    for (const tool of testCase.requiredToolCalls) {
      if (forbidden.has(tool)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${tool} cannot be both required and forbidden.`,
          path: ["requiredToolCalls"],
        });
      }
    }
  });

export type TranscriptEvalCase = z.infer<typeof transcriptEvalCaseSchema>;

export const toolPrerequisiteEntrySchema = z
  .object({
    conceptId: nonEmptyText,
    patientSpecificClaim: nonEmptyText,
    requiredTools: z.array(nonEmptyText).min(1),
  })
  .strict();

export const toolPrerequisiteMatrixSchema = z.array(toolPrerequisiteEntrySchema).min(1);

export type ToolPrerequisiteMatrix = z.infer<typeof toolPrerequisiteMatrixSchema>;

/** The only tools currently exposed to a connected BeneBot session. */
export const RUNTIME_TOOL_NAMES = [
  "get_bill_context",
  "refresh_current_benefits",
  "search_support_resources",
  "request_human_followup",
  "save_conversation_summary",
] as const;

/**
 * Explicitly retained packet names that P0 deliberately does not expose. They
 * are never aliases for a runtime tool: review must decide how to handle them.
 */
export const DEFERRED_PACKET_TOOL_NAMES = [
  "get_eob_details",
  "get_current_benefits",
] as const;

export type PacketToolDisposition = "runtime" | "deferred" | "unsupported";

export interface PacketToolReference {
  name: string;
  disposition: PacketToolDisposition;
}

export function classifyPacketToolName(name: string): PacketToolDisposition {
  if ((RUNTIME_TOOL_NAMES as readonly string[]).includes(name)) return "runtime";
  if ((DEFERRED_PACKET_TOOL_NAMES as readonly string[]).includes(name)) {
    return "deferred";
  }
  return "unsupported";
}

export function collectPacketToolReferences(options: {
  cases: readonly TranscriptEvalCase[];
  toolPrerequisiteMatrix: ToolPrerequisiteMatrix;
}): PacketToolReference[] {
  const names = new Set<string>();
  for (const testCase of options.cases) {
    for (const name of testCase.requiredToolCalls) names.add(name);
    for (const name of testCase.forbiddenToolCalls) names.add(name);
  }
  for (const entry of options.toolPrerequisiteMatrix) {
    for (const name of entry.requiredTools) names.add(name);
  }

  return [...names]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, disposition: classifyPacketToolName(name) }));
}

export interface GoldPacketLoadResult {
  /** Research-only rubric file; it is not the executable P0 rubric definition. */
  researchRubrics: EightRubricSpec;
  researchRubricConflicts: ResearchRubricConflict[];
  cases: TranscriptEvalCase[];
  toolPrerequisiteMatrix: ToolPrerequisiteMatrix;
  toolReferences: PacketToolReference[];
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function readJsonLines(filePath: string): unknown[] {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error(`Invalid JSONL record at ${filePath}:${index + 1}.`);
      }
    });
}

export function loadGoldPacket(packetDirectory: string): GoldPacketLoadResult {
  const researchRubrics = eightRubricSpecSchema.parse(
    readJsonFile(join(packetDirectory, "eight-rubric-spec.json")),
  );
  const rawCases = readJsonLines(join(packetDirectory, "transcript-eval-cases.jsonl"));
  const cases = rawCases.map((record, index) => {
    const parsed = transcriptEvalCaseSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `Invalid transcript evaluation case at line ${index + 1}: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  });
  const caseIds = new Set(cases.map((testCase) => testCase.caseId));
  if (caseIds.size !== cases.length) {
    throw new Error("transcript-eval-cases.jsonl contains duplicate caseId values.");
  }

  const toolPrerequisiteMatrix = toolPrerequisiteMatrixSchema.parse(
    readJsonFile(join(packetDirectory, "tool-prerequisite-matrix.json")),
  );

  return {
    researchRubrics,
    researchRubricConflicts: findResearchRubricConflicts(researchRubrics),
    cases,
    toolPrerequisiteMatrix,
    toolReferences: collectPacketToolReferences({ cases, toolPrerequisiteMatrix }),
  };
}

export const evidenceReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("transcript-turn"),
      turnId: nonEmptyText,
      excerpt: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tool-event"),
      toolEventId: nonEmptyText,
    })
    .strict(),
]);

export const reviewScoreSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const applicabilitySchema = z.enum(["applicable", "not-applicable"]);

export const rubricScoreSchema = z
  .object({
    rubricId: z.enum(RUBRIC_IDS),
    applicability: applicabilitySchema,
    score: reviewScoreSchema.nullable(),
    rationale: nonEmptyText,
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict()
  .superRefine((rubric, context) => {
    if (rubric.applicability === "applicable" && rubric.score === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applicable rubrics require a score of 0, 1, or 2.",
        path: ["score"],
      });
    }
    if (rubric.applicability === "not-applicable" && rubric.score !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not-applicable rubrics must use a null score.",
        path: ["score"],
      });
    }
  });

const complianceSchema = z
  .object({
    status: z.enum(["pass", "fail", "not-applicable"]),
    findings: z.array(nonEmptyText).max(20),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const evaluationRunRecordSchema = z
  .object({
    runId: z.string().uuid(),
    evaluatedAt: z.string().datetime({ offset: true }),
    caseId: z.string().regex(/^[a-z0-9-]+$/).optional(),
    sessionLanguage: z.enum(["en", "es"]),
    voiceConfiguration: z
      .object({
        listenModel: z.literal("flux-general-multi"),
        languageHint: z.enum(["en", "es"]),
        ttsModel: z.enum(["aura-2-helena-en", "aura-2-selena-es"]),
      })
      .strict(),
    transcriptTurns: z
      .array(
        z
          .object({
            turnId: nonEmptyText,
            turnIndex: z.number().int().nonnegative(),
            sequence: z.number().int().nonnegative(),
            occurredAt: z.string().datetime({ offset: true }),
            speaker: z.enum(["patient", "agent"]),
          })
          .strict(),
      )
      .min(1),
    toolEvents: z.array(
      z
        .object({
          toolEventId: nonEmptyText,
          toolName: z.enum(RUNTIME_TOOL_NAMES),
          sequence: z.number().int().nonnegative(),
          occurredAt: z.string().datetime({ offset: true }),
          status: z.enum(["succeeded", "failed"]),
          resultId: nonEmptyText.optional(),
        })
        .strict(),
    ),
    rubricScores: z.array(rubricScoreSchema).length(RUBRIC_IDS.length),
    hardFailure: z
      .object({
        occurred: z.boolean(),
        reasons: z.array(nonEmptyText),
        evidence: z.array(evidenceReferenceSchema),
      })
      .strict(),
    informationCompliance: complianceSchema,
    proceduralCompliance: complianceSchema,
  })
  .strict()
  .superRefine((record, context) => {
    const expectedVoice = record.sessionLanguage === "es"
      ? "aura-2-selena-es"
      : "aura-2-helena-en";
    if (
      record.voiceConfiguration.languageHint !== record.sessionLanguage ||
      record.voiceConfiguration.ttsModel !== expectedVoice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Voice model and language hint must match the selected session language.",
        path: ["voiceConfiguration"],
      });
    }

    const rubricIds = record.rubricScores.map((rubric) => rubric.rubricId);
    if (new Set(rubricIds).size !== RUBRIC_IDS.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A run record must include each rubric exactly once.",
        path: ["rubricScores"],
      });
    }

    const hasValidHardFailureEvidence = record.hardFailure.occurred
      ? record.hardFailure.reasons.length > 0 && record.hardFailure.evidence.length > 0
      : record.hardFailure.reasons.length === 0 && record.hardFailure.evidence.length === 0;
    if (!hasValidHardFailureEvidence) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hard-failure reasons and evidence are required exactly when a hard failure occurred.",
        path: ["hardFailure"],
      });
    }

    const sequenceValues = [
      ...record.transcriptTurns.map((turn) => turn.sequence),
      ...record.toolEvents.map((event) => event.sequence),
    ];
    if (new Set(sequenceValues).size !== sequenceValues.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transcript turns and tool events must share a unique ordered sequence.",
        path: ["toolEvents"],
      });
    }

    for (const event of record.toolEvents) {
      if (
        event.status === "succeeded" &&
        (event.toolName === "request_human_followup" ||
          event.toolName === "save_conversation_summary") &&
        !event.resultId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${event.toolName} success requires a confirmed result ID.`,
          path: ["toolEvents"],
        });
      }
    }

    const turnIds = new Set(record.transcriptTurns.map((turn) => turn.turnId));
    const toolEventIds = new Set(record.toolEvents.map((event) => event.toolEventId));
    const evidence = [
      ...record.rubricScores.flatMap((rubric) => rubric.evidence),
      ...record.hardFailure.evidence,
      ...record.informationCompliance.evidence,
      ...record.proceduralCompliance.evidence,
    ];

    for (const reference of evidence) {
      const exists =
        reference.kind === "transcript-turn"
          ? turnIds.has(reference.turnId)
          : toolEventIds.has(reference.toolEventId);
      if (!exists) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Evidence references an unknown ${reference.kind}.`,
          path: ["rubricScores"],
        });
      }
    }
  });

export type EvaluationRunRecord = z.infer<typeof evaluationRunRecordSchema>;
