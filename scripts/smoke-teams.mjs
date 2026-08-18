import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE_URL = "http://localhost:3000";
mkdirSync("scripts/.smoke", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

try {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", "teamtest@gmail.com");
  await page.fill("#password", "TeamTest123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  console.log("Logged in, at:", page.url());

  await page.goto(`${BASE_URL}/teams`);
  await page.waitForSelector("text=New Team");
  await page.screenshot({ path: "scripts/.smoke/teams-01-empty.png" });

  await page.click("text=New Team");
  await page.waitForSelector("text=Create a Team");
  await page.fill("#name", "Test League - Contenders");
  await page.screenshot({ path: "scripts/.smoke/teams-02-dialog.png" });
  await page.click('button:has-text("Create")');

  await page.waitForURL(/\/teams\/[a-f0-9-]+$/);
  console.log("Team created, at:", page.url());
  await page.waitForSelector("text=Test League - Contenders");
  await page.screenshot({ path: "scripts/.smoke/teams-03-detail.png" });

  // Search and add a player
  await page.fill('input[placeholder*="Search players"]', "Mahomes");
  await page.waitForSelector("text=Add", { timeout: 10000 });
  await page.screenshot({ path: "scripts/.smoke/teams-04-search.png" });
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(1000); // allow revalidation
  await page.screenshot({ path: "scripts/.smoke/teams-05-added.png" });

  // Record a result
  await page.fill('#week', "1");
  await page.selectOption('select#result, [id="result"]', { label: "Win" }).catch(() => {});
  await page.screenshot({ path: "scripts/.smoke/teams-06-before-result.png" });

  console.log("Console/page errors:", errors.length ? errors : "none");
} finally {
  await browser.close();
}
