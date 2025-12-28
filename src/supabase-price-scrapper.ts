import minimist, { ParsedArgs } from 'minimist';
import * as cliProgress from 'cli-progress';
import { consoleHeader, logger, setUpLogger } from './common-lite.js';
import clc from 'cli-color';
import { scrapeEbay } from './scrappers/ebay-scrapper-lite.js';
import { 
  testSupabaseConnection 
} from './supabase-client.js';
import { 
  getCardsNeedingPriceUpdate, 
  getCardsByRarity, 
  getRandomCards,
  insertPriceData,
  CardForPriceScraping
} from './supabase-database.js';

let args: ParsedArgs;

run();

export async function run() {
  args = minimist(process.argv.slice(2), {
    boolean: ['verbose', 'test', 'rare'],
    string: ['rarity'],
    alias: {
      v: 'verbose',
      t: 'test',
      r: 'rare'
    },
    default: {
      limit: 100,
      days: 7,
      rarity: null
    }
  });
  
  setUpLogger(args.v);
  
  consoleHeader('🚀 Supabase Price Scrapper - Japanese Cards');
  
  // Test Supabase connection
  const connected = await testSupabaseConnection();
  if (!connected) {
    logger.error(clc.red('Failed to connect to Supabase. Exiting.'));
    return;
  }
  
  // Test mode - scrape a small random sample
  if (args.t) {
    logger.info(clc.cyan('Running in TEST mode - scraping 5 random cards'));
    await pullRandomCardPrices(5);
    return;
  }
  
  // Scrape by rarity
  if (args.rarity) {
    const rarities = args.rarity.split(',');
    logger.info(clc.cyan(`Scraping cards with rarities: ${rarities.join(', ')}`));
    await pullPricesByRarity(rarities, args.limit);
    return;
  }
  
  // Scrape rare cards only
  if (args.rare) {
    logger.info(clc.cyan('Scraping rare cards only'));
    const rareRarities = ['Ultra Rare', 'Secret Rare', 'Hyper Rare', 'Special Illustration Rare', 'Illustration Rare'];
    await pullPricesByRarity(rareRarities, args.limit);
    return;
  }
  
  // Default: scrape cards that need updates
  logger.info(clc.cyan(`Scraping up to ${args.limit} cards with no prices or prices older than ${args.days} days`));
  await pullPricesForOutdatedCards(args.days, args.limit);
}

/**
 * Pull prices for cards that need updates
 */
async function pullPricesForOutdatedCards(days: number, limit: number) {
  consoleHeader(`Fetching cards needing price updates`);
  
  const cards = await getCardsNeedingPriceUpdate(days, limit);
  
  if (cards.length === 0) {
    logger.info(clc.magenta('No cards need updating!'));
    return;
  }
  
  logger.info(clc.green(`Found ${cards.length} cards to update`));
  await scrapeAndSavePrices(cards);
}

/**
 * Pull prices by rarity
 */
async function pullPricesByRarity(rarities: string[], limit: number) {
  consoleHeader(`Fetching cards by rarity: ${rarities.join(', ')}`);
  
  const cards = await getCardsByRarity(rarities, limit);
  
  if (cards.length === 0) {
    logger.info(clc.magenta(`No cards found with specified rarities`));
    return;
  }
  
  logger.info(clc.green(`Found ${cards.length} cards`));
  await scrapeAndSavePrices(cards);
}

/**
 * Pull prices for random cards (testing)
 */
async function pullRandomCardPrices(count: number) {
  consoleHeader(`Fetching ${count} random cards for testing`);
  
  const cards = await getRandomCards(count);
  
  if (cards.length === 0) {
    logger.info(clc.magenta('No cards found'));
    return;
  }
  
  await scrapeAndSavePrices(cards);
}

/**
 * Scrape prices from eBay and save to Supabase
 */
async function scrapeAndSavePrices(cards: CardForPriceScraping[]) {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const date = new Date().toISOString().split('T')[0];
  
  bar.start(cards.length, 0);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    
    try {
      logger.info(clc.blueBright(`\n[${i + 1}/${cards.length}] Processing: ${card.name} (${card.expName}) #${card.expCardNumber}`));
      
      // Scrape prices from eBay
      logger.info(clc.cyan('  → Scraping raw price...'));
      const rawPrice = await scrapeEbay(card, 'raw');
      
      logger.info(clc.cyan('  → Scraping PSA 9 price...'));
      const psa9Price = await scrapeEbay(card, 'grade9');
      
      logger.info(clc.cyan('  → Scraping PSA 10 price...'));
      const psa10Price = await scrapeEbay(card, 'grade10');
      
      // Log results
      logger.info(clc.yellow(`  💰 Raw: $${rawPrice.toFixed(2)} | PSA 9: $${psa9Price.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)}`));
      
      // Save to Supabase
      const cardId = parseInt(card.cardId);
      const saved = await insertPriceData(cardId, rawPrice, psa9Price, psa10Price, date);
      
      if (saved) {
        successCount++;
        logger.info(clc.green('  ✓ Price data saved to Supabase'));
      } else {
        errorCount++;
        logger.error(clc.red('  ✗ Failed to save price data'));
      }
      
    } catch (error) {
      errorCount++;
      logger.error(clc.red(`  ✗ Error processing card: ${error}`));
    }
    
    bar.update(i + 1);
    
    // Add small delay to avoid rate limiting
    if (i < cards.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  bar.stop();
  
  // Summary
  consoleHeader('Summary');
  logger.info(clc.green(`✓ Successfully scraped: ${successCount} cards`));
  if (errorCount > 0) {
    logger.info(clc.red(`✗ Errors: ${errorCount} cards`));
  }
  logger.info(clc.cyan(`📊 Total processed: ${cards.length} cards`));
}

