import { z } from "zod";

import {
  buildAllowedAmountClarification,
  buildHistoricalRequiredSpokenSummary,
} from "@/lib/billing/historical-narration";
import type { GetBillContextResult } from "@/lib/contracts";
import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import {
  getBillContextForSession,
  getFixtureBillContext,
  isMissingMedplum,
} from "@/lib/medplum/queries";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const inputSchema = z.object({}).strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const claims = await verifyRequestSession(request);
    inputSchema.parse(await request.json());
    let context;
    try {
      context = await getBillContextForSession(claims);
    } catch (error) {
      if (isMissingMedplum(error) && getEnv().NEXT_PUBLIC_DEMO_MODE === "true") {
        context = getFixtureBillContext(claims);
      } else if (isMissingMedplum(error)) {
        throw new BeneBotError(
          "MEDPLUM_NOT_CONFIGURED",
          "Historical bill data is not configured.",
          503,
        );
      } else {
        throw error;
      }
    }

    if (!context.confidence.mathReconciles) {
      throw new BeneBotError(
        "BILL_MATH_MISMATCH",
        "The historical claim amounts do not reconcile well enough to explain numerically.",
        409,
      );
    }

    const adjudication = context.adjudication;
    const result: GetBillContextResult = {
      patientFirstName: context.patient.firstName,
      ...(context.patient.preferredLanguage
        ? {
            preferredLanguage: {
              ...context.patient.preferredLanguage,
              preferred: true as const,
            },
          }
        : {}),
      providerName: context.provider.name,
      serviceDescription: context.service.description,
      dateOfService: context.service.dateOfService,
      encounter: {
        id: context.service.encounterId,
        providerName: context.provider.name,
        facilityName: context.provider.name,
        serviceDescription: context.service.description,
        dateOfService: context.service.dateOfService,
        ...(context.service.location ? { location: context.service.location } : {}),
      },
      invoiceIssuedDate: context.invoice.issuedDate,
      currentBalance: context.invoice.currentBalance,
      historicalAdjudication: {
        billedAmount: adjudication.billedAmount,
        contractualAdjustment: adjudication.contractualAdjustment,
        allowedAmount: adjudication.allowedAmount,
        deductibleApplied: adjudication.deductibleApplied,
        copay: adjudication.copay,
        coinsuranceAmount: adjudication.coinsuranceAmount,
        ...(adjudication.coinsuranceRate === undefined
          ? {}
          : { coinsuranceRate: adjudication.coinsuranceRate }),
        insurerPaid: adjudication.insurerPaid,
        patientResponsibility: adjudication.patientResponsibility,
      },
      source: {
        type: "ExplanationOfBenefit",
        createdDate: adjudication.sourceCreatedDate,
        label: "Historical claim adjudication",
      },
      mathReconciles: true,
      warnings: context.confidence.warnings,
    };

    return Response.json({
      ...result,
      requiredSpokenSummary: buildHistoricalRequiredSpokenSummary(result),
      requiredAllowedAmountClarification: buildAllowedAmountClarification(result),
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
