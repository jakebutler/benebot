# Spanish Concept Library Review Notes

This document captures the regional, linguistic, and strategic decisions made while creating the Spanish counterpart to BeneBot's English concept library. The goal is to provide a natural, patient-facing experience for U.S. Latino patients dealing with medical billing, avoiding overly literal translations or administrative jargon from outside the United States.

## Regional Choices and U.S. Latino Context

The U.S. health insurance system features unique concepts that do not have exact equivalents in many Latin American public health systems. Therefore, the terminology relies on standard translations established by the Centers for Medicare & Medicaid Services (CMS) and major U.S. insurers to ensure consistency and familiarity for patients residing in the U.S. [1] [2]. The language used is a neutral Latin American Spanish, avoiding slang or overly specific regionalisms. It is designed to be easily understood by speakers from Mexico, Central America, South America, and the Caribbean living in the U.S. The tone is maintained as calm, clear, and professional, mirroring the English BeneBot persona.

## Terminology Decisions and Justifications

The selection of preferred terms requires balancing formal accuracy with spoken naturalness. The table below outlines the primary terms chosen, the rationale behind them, and the specific ambiguities they address.

| English Concept | Preferred Spanish Term | Justification | Addressed Ambiguity |
| :--- | :--- | :--- | :--- |
| Allowed Amount | Monto Permitido | Preferred by CMS and major insurers. It sounds more natural in spoken Spanish than "cantidad permitida." | Patients often confuse this with the final bill. The explanation clarifies it is a negotiated limit. |
| Deductible | Deducible | Universally used in U.S. Spanish for health and auto insurance. | Distinguishes between the deductible applied to a past claim and the remaining deductible today. |
| Coinsurance | Coseguro | Aligns with CMS glossaries and is slightly easier for TTS systems to pronounce naturally than "coaseguro." | Often confused with a copay. The explanation emphasizes that coseguro is a percentage. |
| Copay | Copago | The standard, universally understood translation for a flat fee paid at the time of service. | Patients may assume a copay covers the entire cost of a visit. |
| Patient Responsibility | Responsabilidad del paciente | A direct and accurate translation used in billing. | Clarifies that this is the final out-of-pocket total, not a penalty or insurer payment. |
| Explanation of Benefits | Explicación de Beneficios (EOB) | Uses the full term for clarity but introduces the acronym since patients see it on documents. | Prevents patients from treating the EOB as a bill requiring immediate payment. |

## Bilingual Adjudication and False Friends

When translating healthcare terms, certain direct translations can sound overly formal or confusing in a conversational context. For instance, while "reclamación" is technically correct for an insurance claim, "reclamo" is much more common in spoken U.S. Spanish. BeneBot uses "reclamo" to sound conversational and approachable.

Similarly, "factura" is the correct term for a bill. While Spanglish terms like "bile" might be heard in informal settings, BeneBot must maintain a professional standard. Therefore, "factura" is used exclusively in the output, although the system should be prepared to understand Spanglish inputs during voice interactions.

Another challenge is the term "adjudication." A direct translation to "adjudicación" sounds overly legal and intimidating. Instead, BeneBot uses the phrase "cómo se procesó" (how it was processed), which is much clearer for the patient.

## Unavoidable Ambiguities

The most challenging concept to convey is separating the deductible applied to a past claim from the remaining deductible available today. The Spanish text relies heavily on the adjectives "histórico" (historical) and "actual" (current) to enforce this boundary, mirroring the English strategy. This ensures the patient understands that a past EOB does not reflect their real-time financial status.

## Pronunciation and TTS Notes

For Text-to-Speech (TTS) systems, specific formatting is required to ensure natural pronunciation. Acronyms like EOB must be spelled out or formatted so the engine reads them as individual letters in Spanish ("E-O-Be"). Dollar amounts should be read naturally, such as "$620" pronounced as "seiscientos veinte dólares."

Additionally, English provider names like "Bayview Imaging" should ideally be pronounced with English phonetics if the TTS engine supports bilingual voices. If a Spanish-only voice is used, English proper nouns might require phonetic spelling in the actual implementation to avoid distorted audio output.

## References

[1] Centers for Medicare & Medicaid Services. "Términos relacionados al seguro médico que debe saber." https://www.cms.gov/derechos-facturas-medicas/ayuda/guias/terminos-seguro-salud

[2] Cigna Healthcare. "Cómo funcionan los copagos, deducibles y el coseguro." https://www.cigna.com/es-us/knowledge-center/copays-deductibles-coinsurance
