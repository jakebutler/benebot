import { expect, test } from "@playwright/test";

test("explains Jane's historical bill through the deterministic text path", async ({ page }) => {
  // Next's development server treats localhost and 127.0.0.1 as distinct
  // origins for HMR. Use its canonical localhost origin so hydration is not
  // blocked and the conversation launch remains interactive.
  await page.goto("http://localhost:3000/bill/BENEBOT-INV-1001");

  await expect(page.getByRole("heading", { name: "Your July statement" })).toBeVisible();
  await expect(page.getByLabel("Amount due, 620 dollars")).toContainText("$620");
  await expect(page.getByText("Synthetic demo data")).toBeVisible();
  await expect(page.getByLabel("Source distinction")).toContainText(
    "This statement comes from your July claim",
  );
  await expect(page.getByLabel("Source distinction")).toContainText(
    "a separate, current snapshot",
  );

  await page.getByRole("button", { name: "I wanna talk about this" }).click();
  await expect(page.getByRole("heading", { name: "Talk about this bill" })).toBeVisible();

  await page.getByLabel("Message BeneBot").fill("Why do I owe $620?");
  await page.getByRole("button", { name: "Send" }).click();

  const answer = page.getByText(/The historical adjudication.*Bayview Imaging billed/);
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("$2400");
  await expect(answer).toContainText("$1300");
  await expect(answer).toContainText("$1100");
  await expect(answer).toContainText("$500");
  await expect(answer).toContainText("$120");
  await expect(answer).toContainText("$480");
  await expect(answer).toContainText("patient responsibility was $620");
  await expect(answer).toContainText("does not prove the claim is correct");

  await expect(page.getByRole("heading", { name: "What BeneBot is doing" })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Reading historical bill" }).filter({ hasText: "Done" }),
  ).toBeVisible();

  // These are honest discoverability/proof surfaces in the current demo. This
  // deterministic test does not invoke Stedi or pretend to persist a follow-up.
  await page.getByRole("button", { name: "Close BeneBot" }).click();
  await expect(page.getByText("find billing support")).toBeVisible();
  await page.goto("http://localhost:3000/staff");
  await expect(page.getByRole("heading", { name: "What BeneBot creates and when" })).toBeVisible();
  await expect(page.getByText("Appears only after Jane confirms a billing follow-up request.")).toBeVisible();
  await expect(page.getByText("Not requested")).toBeVisible();
  await expect(
    page.getByText("Medplum is not configured, so only the seeded historical records are shown."),
  ).toBeVisible();
});
