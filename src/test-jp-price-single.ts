import { setUpLogger, logger } from './common.js';
import { scrapeEbay, closeBrowser } from './scrappers/ebay-scrapper-puppeteer.js';
import clc from 'cli-color';

const testCard = {
  name: 'Charizard VSTAR',
  expName: 'S12a: VSTAR Universe',
  expCardNumber: '014',
  cardId: 'test-charizard'
};

async function testSingleCard() {
  setUpLogger(true);
  
  logger.info(clc.cyan('🧪 Testing Puppeteer eBay scraper with single card'));
  logger.info(clc.cyan(`Card: ${testCard.name} (${testCard.expName}) #${testCard.expCardNumber}`));
  
  try {
    logger.info(clc.yellow('\n⏳ Scraping raw price...'));
    const rawPrice = await scrapeEbay(testCard, 'raw');
    logger.info(clc.green(`✓ Raw price: $${rawPrice.toFixed(2)}`));
    
    logger.info(clc.yellow('\n⏳ Scraping PSA 9 price...'));
    const psa9Price = await scrapeEbay(testCard, 'grade9');
    logger.info(clc.green(`✓ PSA 9 price: $${psa9Price.toFixed(2)}`));
    
    logger.info(clc.yellow('\n⏳ Scraping PSA 10 price...'));
    const psa10Price = await scrapeEbay(testCard, 'grade10');
    logger.info(clc.green(`✓ PSA 10 price: $${psa10Price.toFixed(2)}`));
    
    logger.info(clc.cyan('\n📊 Summary:'));
    logger.info(clc.white(`  Raw:    $${rawPrice.toFixed(2)}`));
    logger.info(clc.white(`  PSA 9:  $${psa9Price.toFixed(2)}`));
    logger.info(clc.white(`  PSA 10: $${psa10Price.toFixed(2)}`));
    
  } catch (error) {
    logger.error(clc.red(`❌ Error: ${error.message}`));
  } finally {
    await closeBrowser();
  }
}

testSingleCard();

