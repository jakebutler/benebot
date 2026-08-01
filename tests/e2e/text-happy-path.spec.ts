import { expect, test, type Locator } from "@playwright/test";

async function sendText(panel: Locator, message: string): Promise<void> {
  await panel.locator("input").fill(message);
  await panel.locator("form button[type=submit]").click();
}

test("rehearses Jane's Spanish-first billing journey through the text fallback", async ({ page }) => {
  await page.goto("/");

  // The landing page opens with the pitch. The synthetic billing email that
  // starts the patient journey lives further down, under "Try it".
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nobody should need their kid to translate a medical bill.",
  );
  await expect(page.getByText("Vista previa de correo sintético")).toBeVisible();
  await expect(page.getByRole("link", { name: "Quiero hablar sobre esta factura" })).toBeVisible();
  await page.getByRole("link", { name: "Quiero hablar sobre esta factura" }).click();

  await expect(page).toHaveURL(/\/bill\/BENEBOT-INV-1001$/);
  await expect(page.getByText("Sesión segura — Jane Doe")).toBeVisible();
  await expect(page.getByText("Idioma preferido: Español")).toBeVisible();
  await expect(page.getByText("Portal de demostración sintético")).toBeVisible();
  await expect(page.getByLabel("Secure billing context verified")).toContainText("no le pedirá SSN");
  await expect(page.getByLabel("Saldo actual de 620 dólares")).toContainText("$620");
  await expect(page.getByText("Deducible aplicado a la reclamación de julio")).toBeVisible();
  await expect(page.getByText("$500").first()).toBeVisible();
  await expect(page.getByLabel("Diferencia entre fuentes")).toContainText("no explica ni valida");

  await page.getByRole("button", { name: "Hablar sobre esta factura" }).click();
  const panel = page.locator("[data-dg-agent]");
  await expect(panel).toBeVisible();

  await sendText(
    panel,
    "Me cobraron $2,400 por la resonancia, pero el monto permitido fue $1,100 y todavía debo $620. ¿Cómo llegaron a esa cantidad? ¿Y significa que todavía me quedan $500 de deducible?",
  );
  await expect(panel).toContainText("La EOB histórica");
  await expect(panel).toContainText("monto permitido de $1,100.00");
  await expect(panel).toContainText("$500.00 se aplicaron al deducible");
  await expect(panel).toContainText("La factura actual muestra un saldo de $620.00");
  await expect(panel).toContainText("La revisión actual separada");
  await expect(panel).toContainText("no explica ni valida la EOB histórica");

  await sendText(panel, "Espere — ¿qué significa monto permitido?");
  await expect(panel).toContainText("El monto permitido es la cantidad negociada");
  await expect(panel).toContainText("¿Quieres que continúe con el desglose?");
  await expect(panel).toContainText("Interrupción detectada por Flux");

  await sendText(panel, "Quiero consultar mis beneficios actuales.");
  await expect(panel).toContainText(/beneficios actuales|current benefits/i);

  // The text flow must narrow and repeat the concern before it asks for a
  // confirmed billing-review case. Whether a live Medplum project is present
  // determines only the server-confirmed result, never a client-side success claim.
  await sendText(panel, "Todavía no entiendo la diferencia entre el deducible de julio y el actual");
  await expect(panel).toContainText("Para confirmar:");
  await expect(panel).toContainText("La paciente sigue confundida sobre el deducible aplicado al reclamo histórico y el deducible actual.");
  await sendText(panel, "sí");
  await expect(panel).toContainText("El servidor confirmó el caso de revisión de facturación");
  await expect(panel).toContainText("También confirmó el resumen breve para el personal");

  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: "EOB, factura, elegibilidad, caso y comunicación" })).toBeVisible();
  await expect(page.getByText("Preocupación sin resolver")).toBeVisible();
  await expect(page.getByText("ExplanationOfBenefit")).toBeVisible();
  await expect(page.getByText("Invoice")).toBeVisible();
  await expect(page.getByText("CoverageEligibilityResponse")).toBeVisible();
  await expect(page.getByText("Task")).toBeVisible();
  await expect(page.getByText("Communication")).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "CoverageEligibilityResponse" }).getByText(/^ID /)).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Task" }).getByText(/^ID /)).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Communication" }).getByText(/^ID /)).toBeVisible();
});
