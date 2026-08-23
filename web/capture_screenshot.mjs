import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

async function captureRealStudioScreenshot() {
  console.log("📸 Launching headless Edge browser...");
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: fs.existsSync(edgePath) ? edgePath : undefined,
    defaultViewport: {
      width: 1600,
      height: 900,
      deviceScaleFactor: 2,
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  console.log("🌐 Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if Setup or Login is required
  try {
    const submitBtn = await page.$("button[type='submit']");
    if (submitBtn) {
      const inputs = await page.$$("input");
      if (inputs.length >= 5) {
        console.log("👑 Submitting Super Admin Setup Form (karthik / Admin123)...");
        await inputs[0].type("Karthik");
        await inputs[1].type("karthik@devnix.io");
        await inputs[2].type("karthik");
        await inputs[3].type("Admin123");
        await inputs[4].type("Admin123");
        await submitBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else if (inputs.length >= 2) {
        console.log("🔑 Logging in as Admin / Admin123...");
        await inputs[0].type("Admin");
        await inputs[1].type("Admin123");
        await submitBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (authErr) {
    console.log("ℹ️ Auth step:", authErr.message);
  }

  // Wait for Monaco Editor & Studio Workspace to load
  console.log("⏳ Waiting for Monaco Editor & Studio workspace...");
  await page.waitForSelector(".monaco-editor", { timeout: 15000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Click RUN button to trigger execution in Terminal
  try {
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes("RUN")) {
        console.log("⚡ Triggering RUN button in Terminal...");
        await btn.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        break;
      }
    }
  } catch (runErr) {
    console.log("ℹ️ Run trigger:", runErr.message);
  }

  // Click AI ASSIST button to open AI Companion drawer
  try {
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && (text.includes("AI ASSIST") || text.includes("DEVNIX AI"))) {
        console.log("🤖 Opening AI ASSIST Companion panel...");
        await btn.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        break;
      }
    }
  } catch (aiErr) {
    console.log("ℹ️ AI trigger:", aiErr.message);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const docsDir = path.resolve("../docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const docsPath1 = path.join(docsDir, "preview.png");
  const docsPath2 = path.join(docsDir, "devnix_preview.png");

  console.log(`💾 Saving real Devnix Studio screenshot to ${docsPath1}...`);
  await page.screenshot({ path: docsPath1 });
  await page.screenshot({ path: docsPath2 });

  await browser.close();
  console.log("✅ Real Devnix Studio screenshot successfully captured and saved to docs/preview.png!");
}

captureRealStudioScreenshot().catch((err) => {
  console.error("❌ Error capturing screenshot:", err);
  process.exit(1);
});
