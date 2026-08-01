import "server-only";

import { z } from "zod";

const optionalSecret = z.string().min(1).optional();

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("BeneBot"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
  MEDPLUM_BASE_URL: z.string().url().default("https://api.medplum.com/"),
  MEDPLUM_CLIENT_ID: optionalSecret,
  MEDPLUM_CLIENT_SECRET: optionalSecret,
  DEEPGRAM_API_KEY: optionalSecret,
  STEDI_MODE: z.literal("test").default("test"),
  STEDI_TEST_API_KEY: optionalSecret,
  STEDI_ELIGIBILITY_ENDPOINT: z
    .string()
    .url()
    .default(
      "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3",
    ),
  STEDI_PROVIDER_NPI: z.literal("1999999984").default("1999999984"),
  STEDI_PAYER_ID: z.literal("60054").default("60054"),
  STEDI_ALLOW_FIXTURE_FALLBACK: z.enum(["true", "false"]).default("true"),
  STEDI_PROVIDER: z.enum(["direct", "medplum-bot"]).default("direct"),
  BENEBOT_SESSION_SECRET: optionalSecret,
  BENEBOT_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  MOSS_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type BeneBotEnv = z.infer<typeof envSchema>;

let parsedEnv: BeneBotEnv | undefined;

export function getEnv(): BeneBotEnv {
  parsedEnv ??= envSchema.parse(process.env);
  return parsedEnv;
}

export function requireMedplumEnv(): BeneBotEnv & {
  MEDPLUM_CLIENT_ID: string;
  MEDPLUM_CLIENT_SECRET: string;
} {
  const env = getEnv();
  if (!env.MEDPLUM_CLIENT_ID || !env.MEDPLUM_CLIENT_SECRET) {
    throw new Error("MEDPLUM_NOT_CONFIGURED");
  }
  return env as BeneBotEnv & {
    MEDPLUM_CLIENT_ID: string;
    MEDPLUM_CLIENT_SECRET: string;
  };
}

export function requireDeepgramEnv(): BeneBotEnv & { DEEPGRAM_API_KEY: string } {
  const env = getEnv();
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_NOT_CONFIGURED");
  }
  return env as BeneBotEnv & { DEEPGRAM_API_KEY: string };
}

export function requireStediEnv(): BeneBotEnv & { STEDI_TEST_API_KEY: string } {
  const env = getEnv();
  if (!env.STEDI_TEST_API_KEY) {
    throw new Error("STEDI_NOT_CONFIGURED");
  }
  return env as BeneBotEnv & { STEDI_TEST_API_KEY: string };
}
