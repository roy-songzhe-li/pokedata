import puppeteer from 'puppeteer';

const url = 'https://www.ebay.com/sch/i.html?kw=(S12a:%20VSTAR%20Universe)+(Charizard%20VSTAR)+014%20-PSA%20-BGS%20-CGC%20-Digital%20-Online&LH_BIN=1&_sop=15';

async function debug() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: false }); // Show browser
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'ebay-puppeteer-debug.png', fullPage: true });
  
  console.log('Checking selectors...');
  
  // Try different selectors
  const selectors = [
    '.s-item__price',
    '.s-item__detail--primary .s-item__price',
    '[class*="price"]',
    '.s-item',
    '.srp-results'
  ];
  
  for (const selector of selectors) {
    const count = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, selector);
    console.log(`  ${selector}: ${count} elements`);
  }
  
  // Get all price-related elements
  const priceInfo = await page.evaluate(() => {
    const results: any[] = [];
    const items = document.querySelectorAll('.s-item');
    
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const item = items[i];
      results.push({
        title: item.querySelector('.s-item__title')?.textContent?.trim() || 'No title',
        price: item.querySelector('.s-item__price')?.textContent?.trim() || 'No price',
        innerHTML: item.querySelector('.s-item__price')?.innerHTML || 'No HTML'
      });
    }
    
    return results;
  });
  
  console.log('\nFirst 5 items:');
  priceInfo.forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.title}`);
    console.log(`   Price text: ${item.price}`);
    console.log(`   Price HTML: ${item.innerHTML.substring(0, 100)}...`);
  });
  
  console.log('\nClosing browser...');
  await browser.close();
}

debug().catch(console.error);

