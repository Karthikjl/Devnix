import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

async function captureRealScreenshot() {
  console.log("📸 Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1600,
      height: 900,
      deviceScaleFactor: 2, // HiDPI / Retina crisp quality
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  console.log("🌐 Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  // Wait a few seconds for Monaco Editor fonts and themes to fully settle
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const docsDir = path.resolve("../docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const docsPath = path.join(docsDir, "preview.png");

  console.log(`💾 Saving screenshot to ${docsPath}...`);
  await page.screenshot({ path: docsPath });

  await browser.close();
  console.log("✅ Screenshot successfully saved to docs/preview.png!");
}

captureRealScreenshot().catch((err) => {
  console.error("❌ Error capturing screenshot:", err);
  process.exit(1);
});
