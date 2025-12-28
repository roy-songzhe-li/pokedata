/**
 * Debug Puppeteer scraping
 */
import puppeteer from 'puppeteer';

async function debug() {
  const searchQuery = "(S12: Paradigm Trigger)+(Pikachu)+024 -PSA -BGS -CGC";
  const url = `https://www.ebay.com/sch/i.html?kw=${encodeURIComponent(searchQuery)}&LH_BIN=1&_sop=15&LH_Sold=1&LH_Complete=1`;
  
  console.log('URL:', url);
  
  const browser = await puppeteer.launch({ headless: false }); // headless: false to see browser
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('Navigating...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('Page loaded');
  
  // Wait a bit more
  await page.waitForTimeout(3000);
  
  // Try different selectors
  const selectors = [
    '.s-item__price',
    '.s-item__purchase-options .s-item__price',
    '[data-testid="x-price-primary"]',
    '.x-price-primary',
  ];
  
  for (const selector of selectors) {
    const count = await page.$$eval(selector, els => els.length);
    console.log(`\nSelector: ${selector}`);
    console.log(`Found: ${count} elements`);
    
    if (count > 0) {
      const texts = await page.$$eval(selector, els => 
        els.slice(0, 5).map(el => el.textContent?.trim())
      );
      console.log('Texts:', texts);
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: 'debug-ebay.png', fullPage: true });
  console.log('\nScreenshot saved to debug-ebay.png');
  
  // Wait before closing so you can see
  await page.waitForTimeout(5000);
  
  await browser.close();
}

debug().catch(console.error);

