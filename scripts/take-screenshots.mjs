import { chromium } from "playwright";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, "..", "docs", "screenshots");
const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:8000/api";

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Login ---
  console.log("1/7  Taking login page screenshot...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "login.png"),
    fullPage: false,
  });

  // Actually log in
  console.log("     Logging in...");
  await page.fill('input[name="email"], input[type="email"]', "demo@familyvault.local");
  await page.fill('input[name="password"], input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // --- Dashboard ---
  console.log("2/7  Taking dashboard screenshot...");
  // Small delay for animations to settle
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "dashboard.png"),
    fullPage: false,
  });

  // --- IDs page ---
  console.log("3/7  Taking IDs page screenshot...");
  await page.goto(`${BASE_URL}/ids`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "ids.png"),
    fullPage: false,
  });

  // --- Insurance page ---
  console.log("4/7  Taking insurance page screenshot...");
  await page.goto(`${BASE_URL}/insurance`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "insurance.png"),
    fullPage: false,
  });

  // --- Business page ---
  console.log("5/7  Taking business page screenshot...");
  await page.goto(`${BASE_URL}/business`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "business.png"),
    fullPage: false,
  });

  // --- Reminders page ---
  console.log("6/7  Taking reminders page screenshot...");
  await page.goto(`${BASE_URL}/reminders`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "reminders.png"),
    fullPage: false,
  });

  // --- Search page ---
  console.log("7/8  Taking search page screenshot...");
  await page.goto(`${BASE_URL}/search`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  // Type a search query
  const searchInput = page.locator('input[type="text"], input[placeholder*="earch"]').first();
  await searchInput.fill("Smith");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "search.png"),
    fullPage: false,
  });

  // --- Item detail page ---
  console.log("8/8  Taking item detail screenshot...");
  await page.goto(`${BASE_URL}/ids`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const firstCard = page.locator('a[href*="/ids/"]').first();
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, "item-detail.png"),
    fullPage: false,
  });

  await browser.close();
  console.log(`\nDone! Screenshots saved to docs/screenshots/`);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
