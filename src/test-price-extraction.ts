// @ts-ignore
import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// @ts-ignore
puppeteer.use(StealthPlugin());

const url = 'https://www.ebay.com/sch/i.html?kw=(S12a:%20VSTAR%20Universe)+(Charizard%20VSTAR)+014%20-PSA%20-BGS%20-CGC%20-Digital%20-Online&LH_BIN=1&_sop=15';

async function test() {
  console.log('🚀 Launching...');
  // @ts-ignore
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Test price extraction
  const result = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.srp-results li')).slice(0, 10);
    
    return items.map((item, idx) => {
      // Try different price selectors
      const priceSelectors = [
        '.s-item__price',
        '[class*="price"]',
        'span[class*="price"]',
        '.price',
        'span'
      ];
      
      let priceText = '';
      for (const selector of priceSelectors) {
        const el = item.querySelector(selector);
        if (el && el.textContent?.includes('$')) {
          priceText = el.textContent;
          break;
        }
      }
      
      return {
        index: idx,
        innerHTML: item.innerHTML.substring(0, 200),
        priceText: priceText,
        hasPrice: priceText.includes('$')
      };
    });
  });
  
  console.log('\n📊 First 10 items:');
  result.forEach(item => {
    if (item.hasPrice) {
      console.log(`\n✓ Item ${item.index}:`);
      console.log(`  Price: ${item.priceText}`);
    } else {
      console.log(`\n✗ Item ${item.index}: No price found`);
      console.log(`  HTML preview: ${item.innerHTML}...`);
    }
  });
  
  await browser.close();
}

test().catch(console.error);

