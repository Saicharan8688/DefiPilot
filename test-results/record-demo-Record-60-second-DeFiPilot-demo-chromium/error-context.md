# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: record-demo.spec.ts >> Record 60-second DeFiPilot demo
- Location: demo/record-demo.spec.ts:10:5

# Error details

```
Error: page.waitForTimeout: Target page, context or browser has been closed
```

```
Error: write EPIPE
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe.configure({ retries: 0, timeout: 120000 });
  4   | 
  5   | test.use({
  6   |   viewport: { width: 1280, height: 720 },
  7   |   video: { mode: 'on', size: { width: 1280, height: 720 } },
  8   | });
  9   | 
  10  | test('Record 60-second DeFiPilot demo', async ({ page }) => {
  11  |   // --- 0-5s: Hero / Problem ---
  12  |   await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  13  |   await page.waitForTimeout(1000);
  14  |   await page.evaluate(() => window.scrollBy(0, 300));
> 15  |   await page.waitForTimeout(1500);
      |   ^ Error: write EPIPE
  16  | 
  17  |   // --- 5-15s: Connect Wallet / Portfolio ---
  18  |   const connectBtn = page.locator('button:has-text("Connect Wallet")');
  19  |   await expect(connectBtn).toBeVisible({ timeout: 10000 });
  20  |   await connectBtn.click();
  21  |   await page.waitForTimeout(1000);
  22  | 
  23  |   const portfolioB = page.locator('[role="menuitem"]:has-text("Portfolio B"), button:has-text("Portfolio B")').first();
  24  |   await expect(portfolioB).toBeVisible({ timeout: 5000 });
  25  |   await portfolioB.click();
  26  |   await page.waitForTimeout(2500);
  27  | 
  28  |   // --- 15-25s: AI Analysis auto-runs ---
  29  |   const portfolioSection = page.locator('h2:has-text("Portfolio analysis")');
  30  |   await expect(portfolioSection).toBeVisible({ timeout: 10000 });
  31  |   await portfolioSection.scrollIntoViewIfNeeded();
  32  |   await page.waitForTimeout(1000);
  33  | 
  34  |   const donutChart = page.locator('canvas');
  35  |   if (await donutChart.isVisible({ timeout: 2000 })) {
  36  |     await donutChart.hover();
  37  |     await page.waitForTimeout(1000);
  38  |   }
  39  |   await page.evaluate(() => window.scrollBy(0, 400));
  40  |   await page.waitForTimeout(1500);
  41  | 
  42  |   // Wait for AI Analysis to complete - look for the AI ANALYSIS section with recommendation
  43  |   const aiAnalysisHeader = page.locator('h2:has-text("AI ANALYSIS")');
  44  |   await expect(aiAnalysisHeader).toBeVisible({ timeout: 10000 });
  45  |   await aiAnalysisHeader.scrollIntoViewIfNeeded();
  46  | 
  47  |   // Force scroll to AI Analysis section to trigger the query
  48  |   const aiSection = page.locator('#ai-analysis');
  49  |   await aiSection.scrollIntoViewIfNeeded();
  50  |   await page.waitForTimeout(2000);
  51  | 
  52  |   // Wait for AI Analysis to complete - the progress bar should finish and recommendation appear
  53  |   // The AI analysis can take 20-30 seconds in fallback mode
  54  |   await page.waitForTimeout(25000);
  55  | 
  56  |   // Wait for the recommendation section to appear
  57  |   await page.waitForSelector('h3:has-text("Recommended allocation")', { timeout: 30000 });
  58  | 
  59  |   // --- 25-40s: Live Yield Scan + Risk ---
  60  |   const yieldScan = page.locator('h2:has-text("Live yield scan")');
  61  |   await expect(yieldScan).toBeVisible({ timeout: 10000 });
  62  |   await yieldScan.scrollIntoViewIfNeeded();
  63  |   await page.waitForTimeout(1000);
  64  | 
  65  |   const firstRow = page.locator('table tbody tr').first();
  66  |   if (await firstRow.isVisible({ timeout: 2000 })) {
  67  |     await firstRow.hover();
  68  |     await page.waitForTimeout(800);
  69  |   }
  70  | 
  71  |   const lastRow = page.locator('table tbody tr').last();
  72  |   if (await lastRow.isVisible({ timeout: 2000 })) {
  73  |     await lastRow.hover();
  74  |     await page.waitForTimeout(800);
  75  |   }
  76  | 
  77  |   await page.evaluate(() => window.scrollBy(0, 500));
  78  |   await page.waitForTimeout(2000);
  79  | 
  80  |   // --- 40-50s: AI Recommendation ---
  81  |   const recHeader = page.locator('h3:has-text("Recommended allocation")');
  82  |   await expect(recHeader).toBeVisible({ timeout: 10000 });
  83  |   await recHeader.scrollIntoViewIfNeeded();
  84  |   await page.waitForTimeout(1000);
  85  | 
  86  |   const warningsBtn = page.locator('button:has-text("Warnings")');
  87  |   if (await warningsBtn.isVisible({ timeout: 2000 })) {
  88  |     await warningsBtn.click();
  89  |     await page.waitForTimeout(1500);
  90  |   }
  91  | 
  92  |   // --- 50-57s: Simulation + Transaction Preview ---
  93  |   const simulateHeader = page.locator('h3:has-text("Simulate strategy")');
  94  |   await expect(simulateHeader).toBeVisible({ timeout: 10000 });
  95  |   await simulateHeader.scrollIntoViewIfNeeded();
  96  |   await page.waitForTimeout(800);
  97  | 
  98  |   const sliders = page.locator('input[type="range"]');
  99  |   const sliderCount = await sliders.count();
  100 |   if (sliderCount >= 3) {
  101 |     const thirdSlider = sliders.nth(2);
  102 |     const firstSlider = sliders.nth(0);
  103 |     const box3 = await thirdSlider.boundingBox();
  104 |     const box1 = await firstSlider.boundingBox();
  105 |     if (box3 && box1) {
  106 |       await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2);
  107 |       await page.mouse.down();
  108 |       await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, { steps: 10 });
  109 |       await page.mouse.up();
  110 |       await page.waitForTimeout(1500);
  111 |     }
  112 |   }
  113 | 
  114 |   const prepareBtn = page.locator('button:has-text("Prepare transaction")');
  115 |   if (await prepareBtn.isVisible({ timeout: 2000 })) {
```