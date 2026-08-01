import type { Language } from "@/lib/contracts";

const conceptIds = [
  "allowed-amount",
  "explanation-of-benefits",
  "deductible",
  "coinsurance",
  "copayment",
  "out-of-pocket-maximum",
] as const;

type ConceptId = (typeof conceptIds)[number];

const generalDefinitions: Record<ConceptId, Record<Language, string>> = {
  "allowed-amount": {
    en: "The allowed amount is the negotiated price the plan uses to process a covered service and divide responsibility between the patient and the plan. It is not what either side necessarily pays.",
    es: "El monto permitido es el precio negociado que el plan usa para procesar un servicio cubierto y dividir la responsabilidad entre la paciente y el plan. No es necesariamente lo que paga una de las dos partes.",
  },
  "explanation-of-benefits": {
    en: "An Explanation of Benefits, or EOB, is the insurer's summary of how it processed a claim. It is not the provider's bill and does not prove the processing was correct.",
    es: "Una Explicación de Beneficios, o EOB, es el resumen del seguro sobre cómo procesó un reclamo. No es la factura del proveedor ni prueba que el procesamiento sea correcto.",
  },
  deductible: {
    en: "A deductible is an amount the patient pays for covered care before the plan begins sharing many costs. The plan determines which services are exceptions and which payments count.",
    es: "El deducible es una cantidad que la paciente paga por atención cubierta antes de que el plan empiece a compartir muchos costos. El plan determina las excepciones y qué pagos cuentan.",
  },
  coinsurance: {
    en: "Coinsurance is a percentage of the allowed amount that the patient shares with the plan, often after the deductible. The percentage and when it applies depend on the plan.",
    es: "El coseguro es un porcentaje del monto permitido que la paciente comparte con el plan, muchas veces después del deducible. El porcentaje y cuándo se aplica dependen del plan.",
  },
  copayment: {
    en: "A copay is a fixed amount for a covered service or medicine. The plan determines the amount and whether it applies before or after the deductible.",
    es: "El copago es una cantidad fija por un servicio o medicamento cubierto. El plan determina la cantidad y si se aplica antes o después del deducible.",
  },
  "out-of-pocket-maximum": {
    en: "The out-of-pocket maximum is an annual cap on what the patient pays for covered cost sharing. Premiums, non-covered care, and some out-of-network charges may not count.",
    es: "El máximo de gastos de bolsillo es un tope anual de lo que paga la paciente por costos compartidos cubiertos. Las primas, la atención no cubierta y algunos cargos fuera de la red pueden no contar.",
  },
};

interface CompiledLanguageEntry {
  terms: string;
  forbiddenPhrases: string[];
  optionalAnalogy: string;
  analogyBoundary: string;
}

type CompiledConcept = Record<Language, CompiledLanguageEntry>;

/**
 * Code-owned, sanitized promotion of the adjudicated packet. The raw research
 * file intentionally remains outside the runtime import graph because it also
 * contains patient-specific examples and unsupported assertions.
 */
const compiledConcepts: Record<ConceptId, CompiledConcept> = {
  "allowed-amount": {
    en: {
      terms: "allowed amount",
      optionalAnalogy: "The allowed amount is like an approved project budget: the total the plan uses before dividing responsibility.",
      analogyBoundary: "It is not what the patient owes by itself and not what the insurer pays by itself.",
      forbiddenPhrases: ["usual, customary, and reasonable", "We cover the full allowed amount", "This proves the bill is correct"],
    },
    es: {
      terms: "monto permitido; cantidad permitida; tarifa negociada",
      optionalAnalogy: "El monto permitido es como un presupuesto de proyecto aprobado: el total que usa el plan antes de dividir la responsabilidad.",
      analogyBoundary: "No es por sí solo lo que debe la paciente ni lo que paga la aseguradora.",
      forbiddenPhrases: ["prueba que la factura es correcta", "es lo que usted debe pagar", "precio real"],
    },
  },
  "explanation-of-benefits": {
    en: {
      terms: "Explanation of Benefits; EOB",
      optionalAnalogy: "It is like a detailed receipt showing the original price and the adjustments applied.",
      analogyBoundary: "Unlike a store receipt, it reports how the insurer processed a claim and is not the provider bill to pay.",
      forbiddenPhrases: ["This proves the claim is correct", "You must pay this EOB", "It is just an EOB"],
    },
    es: {
      terms: "Explicación de Beneficios; EOB; explicación del reclamo",
      optionalAnalogy: "Es como un recibo detallado que muestra el precio original y los ajustes aplicados.",
      analogyBoundary: "A diferencia de un recibo de tienda, informa cómo procesó el seguro un reclamo y no es la factura del proveedor para pagar.",
      forbiddenPhrases: ["es una factura", "debe pagar esta EOB", "prueba que el cobro es correcto"],
    },
  },
  deductible: {
    en: {
      terms: "deductible",
      optionalAnalogy: "It is like paying for part of a car repair before auto insurance begins sharing covered repair costs.",
      analogyBoundary: "Health plans differ, and some covered services can be paid before the deductible is met.",
      forbiddenPhrases: ["first-dollar coverage", "It is simple, just meet your deductible", "You have to pay everything first"],
    },
    es: {
      terms: "deducible; deducible anual",
      optionalAnalogy: "Es como pagar parte del arreglo de un auto antes de que el seguro empiece a compartir los costos cubiertos.",
      analogyBoundary: "Los planes de salud varían y algunos servicios cubiertos pueden pagarse antes de cumplir el deducible.",
      forbiddenPhrases: ["es una multa", "es lo que usted debe hoy", "es su deducible total"],
    },
  },
  coinsurance: {
    en: {
      terms: "coinsurance",
      optionalAnalogy: "Coinsurance is like sharing fuel costs with a co-driver: each person pays a set share of the covered fuel cost.",
      analogyBoundary: "The plan sets the percentage and when it applies; the split uses the allowed amount, not the billed charge.",
      forbiddenPhrases: ["cost-sharing ratio", "It is a simple percentage", "We cover the rest"],
    },
    es: {
      terms: "coseguro; coaseguro; porcentaje de costo compartido",
      optionalAnalogy: "El coseguro es como compartir el costo del combustible con un copiloto: cada persona paga una parte definida del costo cubierto.",
      analogyBoundary: "El plan define el porcentaje y cuándo se aplica; la división usa el monto permitido, no el cargo facturado.",
      forbiddenPhrases: ["es igual que el copago", "es un cargo extra", "es un impuesto"],
    },
  },
  copayment: {
    en: {
      terms: "copay; copayment",
      optionalAnalogy: "It is like paying a flat entry fee to enter a park.",
      analogyBoundary: "Unlike a park fee, additional covered services during a visit can lead to other cost sharing.",
      forbiddenPhrases: ["fixed tariff", "It is obviously a copay", "You just pay the copay"],
    },
    es: {
      terms: "copago; pago fijo",
      optionalAnalogy: "Es como pagar una tarifa fija de entrada para entrar a un parque.",
      analogyBoundary: "A diferencia de la entrada al parque, otros servicios cubiertos durante una visita pueden generar costos compartidos adicionales.",
      forbiddenPhrases: ["cubre todo el costo", "es el único pago que hará", "es lo mismo que el deducible"],
    },
  },
  "out-of-pocket-maximum": {
    en: {
      terms: "out-of-pocket maximum; out-of-pocket limit",
      optionalAnalogy: "It is like a safety cap on covered cost sharing for the plan year.",
      analogyBoundary: "The cap has plan rules and generally excludes premiums, non-covered care, and some out-of-network charges.",
      forbiddenPhrases: ["stop-loss limit", "catastrophic cap", "We cover one hundred percent of every bill"],
    },
    es: {
      terms: "máximo de gastos de bolsillo; límite de bolsillo; tope de gastos",
      optionalAnalogy: "Es como un tope de seguridad para los costos compartidos cubiertos durante el año del plan.",
      analogyBoundary: "El tope tiene reglas del plan y por lo general excluye primas, atención no cubierta y algunos cargos fuera de la red.",
      forbiddenPhrases: ["cubre todo sin importar el doctor", "incluye la prima mensual", "una vez que lo alcanza, no paga nada nunca más"],
    },
  },
};

/**
 * Compiles only the approved generic subset of the adjudicated gold packet.
 * Patient-specific examples in the packet remain evaluation data and are never
 * copied into the system prompt.
 */
export function createApprovedConceptGuidance(language: Language): string {
  return conceptIds
    .map((conceptId) => {
      const entry = compiledConcepts[conceptId][language];
      return [
        `- ${conceptId}: ${generalDefinitions[conceptId][language]}`,
        `  Preferred terms: ${entry.terms}`,
        `  Approved optional analogy: ${entry.optionalAnalogy}`,
        `  Analogy boundary: ${entry.analogyBoundary}`,
        `  Never say: ${entry.forbiddenPhrases.join(" | ")}`,
      ].join("\n");
    })
    .join("\n");
}
