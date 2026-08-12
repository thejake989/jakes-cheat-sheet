import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const email = `smoketest${Date.now()}@gmail.com`;
const password = "SmokeTest123!";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

try {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("text=Jake's Cheat Sheet");
  await page.screenshot({ path: "scripts/.smoke/01-login.png" });

  await page.click("text=Sign up");
  await page.waitForSelector("text=Create an account");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.screenshot({ path: "scripts/.smoke/02-signup.png" });
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/login/);
  await page.screenshot({ path: "scripts/.smoke/03-post-signup.png" });

  console.log("Signup flow completed. Landed at:", page.url());
  console.log("Console/page errors:", errors.length ? errors : "none");
} finally {
  await browser.close();
}
