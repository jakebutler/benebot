import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEEPGRAM_TOOL_DEFINITIONS,
  dispatchBeneBotTool,
} from "../../lib/deepgram/tools";

describe("Deepgram tool bridge", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("declares exactly the five scoped BeneBot tools", () => {
    expect(DEEPGRAM_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "get_bill_context",
      "refresh_current_benefits",
      "search_support_resources",
      "request_human_followup",
      "save_conversation_summary",
    ]);
  });

  it("sends only validated tool input and the signed session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ patientFirstName: "Jane", mathReconciles: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchBeneBotTool({
      name: "get_bill_context",
      argumentsJson: "{}",
      sessionToken: "signed-session",
    });

    expect(JSON.parse(result)).toMatchObject({ patientFirstName: "Jane" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/get-bill-context",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer signed-session",
        }),
        body: "{}",
      }),
    );
  });

  it("rejects unknown fields before a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchBeneBotTool({
      name: "get_bill_context",
      argumentsJson: JSON.stringify({ patientId: "other-patient" }),
      sessionToken: "signed-session",
    });

    expect(JSON.parse(result)).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts only the confirmed concise billing-case payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ created: true, status: "requested", taskId: "task-1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await dispatchBeneBotTool({
      name: "request_human_followup",
      argumentsJson: JSON.stringify({
        issueType: "deductible",
        patientIssueSummary:
          "La paciente sigue confundida sobre el deducible histórico y actual.",
        preferredContact: "secure-message",
        patientConfirmed: true,
      }),
      sessionToken: "signed-session",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/request-followup",
      expect.objectContaining({
        body: JSON.stringify({
          issueType: "deductible",
          patientIssueSummary:
            "La paciente sigue confundida sobre el deducible histórico y actual.",
          preferredContact: "secure-message",
          patientConfirmed: true,
        }),
      }),
    );
  });
});
