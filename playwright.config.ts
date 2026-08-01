import { defineConfig } from "@playwright/test";

// Next development hydration uses localhost as its canonical origin, so the
// rehearsal stays on that host. The port is configurable so the suite can run
// against a worktree checkout while another dev server holds the default port.
const port = process.env.BENEBOT_E2E_PORT ?? "3000";
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: origin,
  },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: origin,
    reuseExistingServer: true,
  },
});
