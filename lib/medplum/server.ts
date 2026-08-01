import "server-only";

import { MedplumClient } from "@medplum/core";

import { getEnv, requireMedplumEnv } from "@/lib/env";

export class MedplumNotConfiguredError extends Error {
  readonly code = "MEDPLUM_NOT_CONFIGURED";

  constructor() {
    super("Medplum client credentials are not configured.");
    this.name = "MedplumNotConfiguredError";
  }
}

let clientPromise: Promise<MedplumClient> | undefined;

export function isMedplumConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.MEDPLUM_CLIENT_ID && env.MEDPLUM_CLIENT_SECRET);
}

async function connectMedplum(): Promise<MedplumClient> {
  let env: ReturnType<typeof requireMedplumEnv>;
  try {
    env = requireMedplumEnv();
  } catch {
    throw new MedplumNotConfiguredError();
  }

  const client = new MedplumClient({ baseUrl: env.MEDPLUM_BASE_URL });
  await client.startClientLogin(env.MEDPLUM_CLIENT_ID, env.MEDPLUM_CLIENT_SECRET);
  return client;
}

export async function getMedplumClient(): Promise<MedplumClient> {
  clientPromise ??= connectMedplum().catch((error: unknown) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

