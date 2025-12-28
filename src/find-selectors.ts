// @ts-ignore
import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

// @ts-ignore
puppeteer.use(StealthPlugin());

const url = 'https://www.ebay.com/sch/i.html?kw=(S12a:%20VSTAR%20Universe)+(Charizard%20VSTAR)+014%20-PSA%20-BGS%20-CGC%20-Digital%20-Online&LH_BIN=1&_sop=15';

async function findSelectors() {
  console.log('🚀 Launching...');
  // @ts-ignore
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Save HTML
  const html = await page.content();
  fs.writeFileSync('ebay-page.html', html);
  console.log('✓ Saved HTML');
  
  // Try different selectors
  const selectors = [
    'li.s-item',
    '[class*="s-item"]',
    '[class*="item"]',
    'li',
    '[data-view]',
    '.srp-results li',
    'ul.srp-results li'
  ];
  
  console.log('\n🔍 Testing selectors:');
  for (const selector of selectors) {
    const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
    if (count > 0) {
      console.log(`  ✓ ${selector}: ${count} elements`);
    }
  }
  
  // Get class names from first few list items
  const classes = await page.evaluate(() => {
    const lis = Array.from(document.querySelectorAll('li')).slice(0, 10);
    return lis.map(li => li.className);
  });
  
  console.log('\n📋 First 10 <li> class names:');
  classes.forEach((c, i) => {
    if (c) console.log(`  ${i + 1}. "${c}"`);
  });
  
  await browser.close();
}

findSelectors().catch(console.error);

