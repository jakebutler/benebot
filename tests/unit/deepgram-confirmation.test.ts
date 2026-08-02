import { describe, expect, it, vi } from "vitest";

import {
  createVoiceConfirmationTracker,
  dispatchWithFollowupConfirmation,
  isExplicitFollowupConfirmation,
  isExplicitFollowupPrompt,
  recordVoiceConversationEntry,
} from "@/lib/deepgram/confirmation";

describe("isExplicitFollowupConfirmation", () => {
  it.each([
    "Sí.",
    "si por favor",
    "Yes",
    "Yes, please",
    "Yes, create the case",
    "go ahead!",
    "de acuerdo",
    "Sí, cree el caso.",
  ])("accepts a standalone confirmation: %s", (message) => {
    expect(isExplicitFollowupConfirmation(message)).toBe(true);
  });

  it.each([
    undefined,
    "No recibí una resonancia.",
    "Sigo confundida, sí aparece una resonancia en el registro.",
    "¿Me puede ayudar?",
    "Maybe",
    "Yes, but do not create it",
    "Sí, pero no cree nada",
    "No",
  ])("rejects a non-confirming utterance: %s", (message) => {
    expect(isExplicitFollowupConfirmation(message)).toBe(false);
  });
});

describe("voice confirmation evidence", () => {
  it("binds a patient answer to only the assistant prompt since the previous user turn", () => {
    let tracker = createVoiceConfirmationTracker();
    tracker = recordVoiceConversationEntry(tracker, {
      role: "assistant",
      content: "¿Quiere que cree un caso de revisión por mensaje seguro?",
    });
    tracker = recordVoiceConversationEntry(tracker, {
      role: "user",
      content: "Sí, por favor.",
    });

    expect(tracker.evidence).toEqual({
      latestUserMessage: "Sí, por favor.",
      promptBeforeLatestUser:
        "¿Quiere que cree un caso de revisión por mensaje seguro?",
    });

    tracker = recordVoiceConversationEntry(tracker, {
      role: "user",
      content: "Sí.",
    });
    expect(tracker.evidence.promptBeforeLatestUser).toBe("");
  });
});

describe("dispatchWithFollowupConfirmation", () => {
  const argumentsJson = JSON.stringify({
    issueType: "service-not-recognized",
    patientIssueSummary: "La paciente no reconoce la resonancia.",
    preferredContact: "secure-message",
    patientConfirmed: true,
  });

  it("does not dispatch a follow-up when the preceding prompt was not explicit", async () => {
    const dispatch = vi.fn(async () => JSON.stringify({ created: true }));

    const result = await dispatchWithFollowupConfirmation({
      toolName: "request_human_followup",
      argumentsJson,
      language: "es",
      evidence: {
        latestUserMessage: "Sí, por favor.",
        promptBeforeLatestUser: "¿Quiere que le explique algo más?",
      },
      dispatch,
    });

    expect(result.dispatched).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.parse(result.result)).toMatchObject({
      created: false,
      error: "EXPLICIT_PATIENT_CONFIRMATION_REQUIRED",
    });
  });

  it("dispatches after an explicit prompt and standalone confirmation", async () => {
    const dispatch = vi.fn(async () => JSON.stringify({
      created: true,
      status: "requested",
      taskId: "task-1",
    }));

    const result = await dispatchWithFollowupConfirmation({
      toolName: "request_human_followup",
      argumentsJson,
      language: "es",
      evidence: {
        latestUserMessage: "Sí, por favor.",
        promptBeforeLatestUser:
          "¿Quiere que cree un caso de revisión de facturación por mensaje seguro?",
      },
      dispatch,
    });

    expect(result.dispatched).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(JSON.parse(result.result)).toMatchObject({ created: true, taskId: "task-1" });
  });

  it("does not reflect an oversized model summary into the patient prompt", async () => {
    const result = await dispatchWithFollowupConfirmation({
      toolName: "request_human_followup",
      argumentsJson: JSON.stringify({ patientIssueSummary: "x".repeat(301) }),
      language: "en",
      evidence: {},
      dispatch: vi.fn(),
    });
    const response = JSON.parse(result.result) as { requiredResponse: string };

    expect(response.requiredResponse).toContain(
      "The patient does not recognize the service listed on the bill.",
    );
    expect(response.requiredResponse).not.toContain("x".repeat(301));
  });
});

describe("isExplicitFollowupPrompt", () => {
  it("requires the Spanish case, contact method, and confirmation request", () => {
    expect(
      isExplicitFollowupPrompt(
        "Para confirmar: no reconoce la resonancia. ¿Quiere que cree un caso de revisión de facturación por mensaje seguro?",
        "es",
      ),
    ).toBe(true);
    expect(
      isExplicitFollowupPrompt("¿Le gustaría que le ayude a revisar esto más a fondo?", "es"),
    ).toBe(false);
  });

  it("requires the English case, contact method, and confirmation request", () => {
    expect(
      isExplicitFollowupPrompt(
        "Would you like me to create a billing-review case and ask the team to contact you by secure message?",
        "en",
      ),
    ).toBe(true);
    expect(isExplicitFollowupPrompt("Would you like more help?", "en")).toBe(false);
  });
});
