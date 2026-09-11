import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 0, timeout: 120000 });

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

test('Record 60-second DeFiPilot demo', async ({ page }) => {
  // --- 0-5s: Hero / Problem ---
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(1500);

  // --- 5-15s: Connect Wallet / Portfolio ---
  const connectBtn = page.locator('button:has-text("Connect Wallet")');
  await expect(connectBtn).toBeVisible({ timeout: 10000 });
  await connectBtn.click();
  await page.waitForTimeout(1000);

  const portfolioB = page.locator('[role="menuitem"]:has-text("Portfolio B"), button:has-text("Portfolio B")').first();
  await expect(portfolioB).toBeVisible({ timeout: 5000 });
  await portfolioB.click();
  await page.waitForTimeout(2500);

  // Wait for wallet connection to be established and query to trigger
  await page.waitForTimeout(3000);

  // --- 15-25s: AI Analysis auto-runs ---
  const portfolioSection = page.locator('h2:has-text("Portfolio analysis")');
  await expect(portfolioSection).toBeVisible({ timeout: 10000 });
  await portfolioSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const donutChart = page.locator('canvas');
  if (await donutChart.isVisible({ timeout: 2000 })) {
    await donutChart.hover();
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1500);

  // Wait for AI Analysis to complete - look for the AI ANALYSIS section with recommendation
  const aiAnalysisHeader = page.locator('h2:has-text("Your AI analysis")');
  await expect(aiAnalysisHeader).toBeVisible({ timeout: 15000 });
  await aiAnalysisHeader.scrollIntoViewIfNeeded();

  // Force scroll to AI Analysis section to trigger the query
  const aiSection = page.locator('#ai-analysis');
  await aiSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);

  // Debug: check what's in the AI analysis section
  const aiSectionContent = await aiSection.innerHTML();
  console.log('AI Analysis section content length:', aiSectionContent.length);
  console.log('AI Analysis section preview:', aiSectionContent.substring(0, 500));

  // Wait for AI Analysis to complete - the progress bar should finish and recommendation appear
  // The AI analysis can take 30-40 seconds in fallback mode with network latency
  await page.waitForTimeout(45000);

  // Debug: check again
  const aiSectionContent2 = await aiSection.innerHTML();
  console.log('AI Analysis section content length after wait:', aiSectionContent2.length);
  console.log('AI Analysis section preview after wait:', aiSectionContent2.substring(0, 500));

  // Check if there's an error state
  const errorState = aiSection.locator('.text-red-300, [class*="error"], [class*="Error"]');
  const errorCount = await errorState.count();
  console.log('Error state count:', errorCount);
  if (errorCount > 0) {
    const errorText = await errorState.first().innerText();
    console.log('Error text:', errorText);
  }

  // Check if there's a loading state
  const loadingState = aiSection.locator('[class*="Spinner"], [class*="spinner"], [class*="loading"]');
  const loadingCount = await loadingState.count();
  console.log('Loading state count:', loadingCount);

  // Wait for the recommendation section to appear
  await page.waitForSelector('h2:has-text("Recommended allocation")', { timeout: 60000 });

  // --- 25-40s: Live Yield Scan + Risk ---
  const yieldScan = page.locator('h2:has-text("Live yield scan")');
  await expect(yieldScan).toBeVisible({ timeout: 10000 });
  await yieldScan.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const firstRow = page.locator('table tbody tr').first();
  if (await firstRow.isVisible({ timeout: 2000 })) {
    await firstRow.hover();
    await page.waitForTimeout(800);
  }

  const lastRow = page.locator('table tbody tr').last();
  if (await lastRow.isVisible({ timeout: 2000 })) {
    await lastRow.hover();
    await page.waitForTimeout(800);
  }

  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(2000);

  // --- 40-50s: AI Recommendation ---
  const recHeader = page.locator('h2:has-text("Recommended allocation")');
  await expect(recHeader).toBeVisible({ timeout: 10000 });
  await recHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const warningsBtn = page.locator('button:has-text("Warnings")');
  if (await warningsBtn.isVisible({ timeout: 2000 })) {
    await warningsBtn.click();
    await page.waitForTimeout(1500);
  }

  // --- 50-57s: Simulation + Transaction Preview ---
  const simulateBtn = page.locator('button:has-text("Simulate strategy")');
  await expect(simulateBtn).toBeVisible({ timeout: 10000 });
  await simulateBtn.scrollIntoViewIfNeeded();
  await simulateBtn.click();
  await page.waitForTimeout(3000);

  // Wait for simulation results panel to appear
  const simulateHeader = page.locator('h2:has-text("Simulate strategy")');
  await expect(simulateHeader).toBeVisible({ timeout: 10000 });
  await simulateHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const sliders = page.locator('input[type="range"]');
  const sliderCount = await sliders.count();
  if (sliderCount >= 3) {
    const thirdSlider = sliders.nth(2);
    const firstSlider = sliders.nth(0);
    const box3 = await thirdSlider.boundingBox();
    const box1 = await firstSlider.boundingBox();
    if (box3 && box1) {
      await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2);
      await page.mouse.down();
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }
  }

  const prepareBtn = page.locator('button:has-text("Prepare transaction")');
  if (await prepareBtn.isVisible({ timeout: 2000 })) {
    await prepareBtn.click();
    await page.waitForTimeout(2500);
  }

  // --- 57-60s: Close ---
  const hero = page.locator('h1').first();
  await hero.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // Final pause to let video finish cleanly
  await page.waitForTimeout(2000);
});