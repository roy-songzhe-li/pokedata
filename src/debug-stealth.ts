// @ts-ignore
import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// @ts-ignore
puppeteer.use(StealthPlugin());

const url = 'https://www.ebay.com/sch/i.html?kw=(S12a:%20VSTAR%20Universe)+(Charizard%20VSTAR)+014%20-PSA%20-BGS%20-CGC%20-Digital%20-Online&LH_BIN=1&_sop=15';

async function debug() {
  console.log('🚀 Launching browser with stealth...');
  // @ts-ignore
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('📡 Navigating...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  console.log('⏳ Waiting 3s...');
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('📸 Taking screenshot...');
  await page.screenshot({ path: 'ebay-stealth-test.png', fullPage: true });
  
  console.log('🔍 Checking selectors...');
  const itemCount = await page.evaluate(() => document.querySelectorAll('.s-item').length);
  const priceCount = await page.evaluate(() => document.querySelectorAll('.s-item__price').length);
  
  console.log(`  .s-item: ${itemCount} elements`);
  console.log(`  .s-item__price: ${priceCount} elements`);
  
  if (itemCount > 0) {
    const firstItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.s-item')).slice(0, 3);
      return items.map(item => ({
        title: item.querySelector('.s-item__title')?.textContent || '',
        price: item.querySelector('.s-item__price')?.textContent || ''
      }));
    });
    
    console.log('\n✓ Found items:');
    firstItems.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   Price: ${item.price}`);
    });
  }
  
  await browser.close();
  console.log('\n✓ Done!');
}

debug().catch(console.error);

