export class BeneBotError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "BeneBotError";
  }
}

export function safeErrorResponse(error: unknown): Response {
  if (error instanceof BeneBotError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  const requestId = crypto.randomUUID();
  console.error("benebot_request_failed", { requestId });
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "BeneBot could not complete that request.",
        requestId,
      },
    },
    { status: 500 },
  );
}
