import type { GetBillContextResult } from "@/lib/contracts";

export interface HistoricalRequiredSpokenSummary {
  en: string;
  es: string;
}

function formatUsd(amount: number, language: "en" | "es"): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return language === "es" ? `${formatted} dólares` : `$${formatted}`;
}

function formatDate(value: string, language: "en" | "es"): string {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = isoDate
    ? new Date(
        Date.UTC(
          Number(isoDate[1]),
          Number(isoDate[2]) - 1,
          Number(isoDate[3]),
        ),
      )
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function spokenServiceDescription(value: string, language: "en" | "es"): string {
  const normalized = value.trim().toLowerCase();
  const isLumbarMri =
    normalized === "lumbar mri" ||
    normalized === "mri of the lower back" ||
    normalized === "lower back mri";
  if (!isLumbarMri) return value;
  return language === "es" ? "una resonancia magnética lumbar" : "an MRI of the lower back";
}

/**
 * Provisional, deterministic narration for the historical bill tool result.
 *
 * This module deliberately contains no claim math. It only formats values that
 * have already been normalized and reconciled by application code.
 */
export function buildHistoricalRequiredSpokenSummary(
  context: GetBillContextResult,
): HistoricalRequiredSpokenSummary {
  if (!context.mathReconciles) {
    return {
      en: "The historical claim amounts do not reconcile, so I cannot safely give a numerical breakdown. I can send this bill for human review.",
      es: "Los importes del reclamo histórico no cuadran, así que no puedo dar un desglose numérico de forma segura. Puedo enviar esta factura a revisión humana.",
    };
  }

  const amounts = context.historicalAdjudication;
  const sourceDateEn = formatDate(context.source.createdDate, "en");
  const sourceDateEs = formatDate(context.source.createdDate, "es");
  const serviceDateEn = formatDate(context.dateOfService, "en");
  const serviceDateEs = formatDate(context.dateOfService, "es");
  const serviceEn = spokenServiceDescription(context.serviceDescription, "en");
  const serviceEs = spokenServiceDescription(context.serviceDescription, "es");

  return {
    en: [
      `For ${serviceEn} on ${serviceDateEn} from ${context.providerName}, the historical Explanation of Benefits created on ${sourceDateEn} says the provider billed ${formatUsd(amounts.billedAmount, "en")}.`,
      `It shows a contractual adjustment of ${formatUsd(amounts.contractualAdjustment, "en")}, leaving an allowed amount of ${formatUsd(amounts.allowedAmount, "en")}.`,
      `Of that allowed amount, ${formatUsd(amounts.deductibleApplied, "en")} was applied to the deductible, the copay was ${formatUsd(amounts.copay, "en")}, and coinsurance was ${formatUsd(amounts.coinsuranceAmount, "en")}.`,
      `The insurer paid ${formatUsd(amounts.insurerPaid, "en")}, and the historical patient responsibility was ${formatUsd(amounts.patientResponsibility, "en")}.`,
      `The current invoice balance is ${formatUsd(context.currentBalance, "en")}.`,
      "This is a record of how the insurer adjudicated that historical claim, not proof that the claim or bill is correct. Current benefits are a separate, separately dated check and do not explain or validate this historical claim.",
    ].join(" "),
    es: [
      `Para ${serviceEs}, con fecha de servicio del ${serviceDateEs} en ${context.providerName}, la Explicación de Beneficios histórica creada el ${sourceDateEs} indica que el proveedor facturó ${formatUsd(amounts.billedAmount, "es")}.`,
      `Muestra un ajuste contractual de ${formatUsd(amounts.contractualAdjustment, "es")}, lo que dejó un monto permitido de ${formatUsd(amounts.allowedAmount, "es")}.`,
      `De ese monto permitido, ${formatUsd(amounts.deductibleApplied, "es")} se aplicaron al deducible, el copago fue de ${formatUsd(amounts.copay, "es")} y el coaseguro fue de ${formatUsd(amounts.coinsuranceAmount, "es")}.`,
      `La aseguradora pagó ${formatUsd(amounts.insurerPaid, "es")}, y la responsabilidad histórica de la paciente fue de ${formatUsd(amounts.patientResponsibility, "es")}.`,
      `El saldo actual de la factura es de ${formatUsd(context.currentBalance, "es")}.`,
      "Este es un registro de cómo la aseguradora adjudicó ese reclamo histórico, no una prueba de que el reclamo o la factura sean correctos. Los beneficios actuales requieren una consulta separada con su propia fecha y no explican ni validan este reclamo histórico.",
    ].join(" "),
  };
}

/** A short, deterministic clarification for the rehearsed interruption. */
export function buildAllowedAmountClarification(
  context: GetBillContextResult,
): HistoricalRequiredSpokenSummary {
  if (!context.mathReconciles) {
    return {
      en: "The allowed amount is the negotiated price the plan uses to process a covered service and divide responsibility. I cannot safely quote this claim's figures because its amounts do not reconcile.",
      es: "El monto permitido es el precio negociado que el plan usa para procesar un servicio cubierto y dividir la responsabilidad. No puedo citar con seguridad las cifras de este reclamo porque sus importes no cuadran.",
    };
  }

  const amounts = context.historicalAdjudication;
  return {
    en: `The allowed amount is the negotiated price the plan used to process this claim. The record shows ${formatUsd(amounts.allowedAmount, "en")}, not the ${formatUsd(amounts.billedAmount, "en")} the provider charged. It is not necessarily what you pay or what the plan pays. Would you like me to continue the breakdown?`,
    es: `El monto permitido es el precio negociado que el plan usó para procesar este reclamo. El registro muestra ${formatUsd(amounts.allowedAmount, "es")}, no los ${formatUsd(amounts.billedAmount, "es")} que facturó el proveedor. No es necesariamente lo que paga usted ni lo que paga el plan. ¿Quiere que continúe con el desglose?`,
  };
}
