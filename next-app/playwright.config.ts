import { defineConfig } from "@playwright/test";

export const PORT = 3100;
export const LEGACY_DOWN_PORT = 3101;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: [
    {
      command: "php -S 127.0.0.1:8000 ../legacy-php/index.php",
      url: "http://127.0.0.1:8000/api/articles",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/articles`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx next start -p ${LEGACY_DOWN_PORT}`,
      url: `http://127.0.0.1:${LEGACY_DOWN_PORT}/articles`,
      reuseExistingServer: !process.env.CI,
      env: {
        LEGACY_ORIGIN: "http://127.0.0.1:1",
        MIGRATED_SLUGS: "why-we-are-moving-to-nextjs,a-field-guide-to-legacy-data,caching-without-tears",
      },
    },
  ],
});
