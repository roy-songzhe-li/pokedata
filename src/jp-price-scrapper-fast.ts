import minimist, { ParsedArgs } from 'minimist';
import * as cliProgress from 'cli-progress';
import { consoleHeader, logger, setUpLogger } from './common.js';
import { upsertPrice, useTestDbFile } from './database.js';
import clc from 'cli-color';
import { scrapeEbay, closeBrowser } from './scrappers/ebay-scrapper-puppeteer.js';
import { Price, Card } from './model/Card.js';
import Database from 'better-sqlite3';

const DB_FILE = './databases/data.sqlite';
const PRICE_DB_FILE = './databases/prices.sqlite';

let args: ParsedArgs;

run();

export async function run() {
  args = minimist(process.argv.slice(2), {
    boolean: ['dryrun', 'verbose', 'test'],
    alias: {
      d: 'dryrun',
      v: 'verbose',
      t: 'test'
    },
    default: {
      limit: 100,
      months: 3,
      concurrent: 3  // Concurrent cards to process
    }
  });

  setUpLogger(args.verbose);

  if (args.dryrun) {
    useTestDbFile(true);
    logger.info(clc.red.bold(`------------------ DRYRUN --------------------`));
    logger.info(clc.red.bold(`--------- Results at test-data.sql -----------`));
    logger.info(clc.red.bold(`------------------ DRYRUN --------------------`));
  }

  consoleHeader('🎌 Japanese Card Price Scraper - FAST MODE');
  logger.info(clc.yellow(`⚡ Concurrent processing: ${args.concurrent} cards at a time`));
  
  try {
    if (args.test) {
      await scrapeTestCards();
    } else {
      await scrapeHistoricalPrices(args.months, args.limit, args.concurrent);
    }
  } finally {
    await closeBrowser();
  }
}

async function scrapeTestCards() {
  logger.info(clc.cyan('Running in TEST mode - scraping 5 random Japanese cards'));
  
  const db = new Database(DB_FILE);
  const cards = db.prepare(`
    SELECT * FROM cards 
    WHERE language = 'jp' 
    AND expCardNumber IS NOT NULL 
    AND expCardNumber != ''
    ORDER BY RANDOM() 
    LIMIT 5
  `).all() as Card[];
  db.close();

  if (cards.length === 0) {
    logger.warn(clc.yellow('No Japanese cards found in database'));
    return;
  }

  logger.info(clc.green(`Found ${cards.length} cards to test`));
  await scrapePricesConcurrent(cards, 2);
}

async function scrapeHistoricalPrices(months: number, limit: number, concurrent: number) {
  logger.info(clc.cyan(`Scraping ${months} months of historical price data`));
  logger.info(clc.cyan(`Limit: ${limit} cards`));

  const db = new Database(DB_FILE);
  const priceDb = new Database(PRICE_DB_FILE);

  db.prepare(`ATTACH DATABASE '${PRICE_DB_FILE}' AS priceDB`).run();

  const cards = db.prepare(`
    SELECT c.* FROM cards c
    WHERE c.language = 'jp'
    AND c.expCardNumber IS NOT NULL
    AND c.expCardNumber != ''
    AND c.cardId NOT IN (
      SELECT cardId FROM priceDB.prices
      WHERE date >= date('now', '-${months} months')
    )
    ORDER BY RANDOM()
    LIMIT ${limit}
  `).all() as Card[];

  db.close();
  priceDb.close();

  if (cards.length === 0) {
    logger.info(clc.yellow('No cards need price updates'));
    return;
  }

  logger.info(clc.green(`Found ${cards.length} cards needing price updates`));
  await scrapePricesConcurrent(cards, concurrent);
}

/**
 * Scrape prices for cards with concurrent processing
 */
async function scrapePricesConcurrent(cards: Card[], concurrency: number) {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const date = new Date();

  bar.start(cards.length, 0);
  let successCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  // Process cards in batches
  for (let i = 0; i < cards.length; i += concurrency) {
    const batch = cards.slice(i, i + concurrency);
    
    // Process batch concurrently
    const results = await Promise.allSettled(
      batch.map(card => scrapeCardPrices(card, date))
    );

    // Handle results
    for (const result of results) {
      processedCount++;
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      } else {
        errorCount++;
        if (result.status === 'rejected') {
          logger.error(clc.red(`  ✗ Error: ${result.reason}`));
        }
      }
      bar.update(processedCount);
    }
  }

  bar.stop();

  consoleHeader('Summary');
  logger.info(clc.green(`✓ Successfully scraped: ${successCount} cards`));
  if (errorCount > 0) {
    logger.warn(clc.yellow(`⚠ Errors: ${errorCount} cards`));
  }
  logger.info(clc.blue(`📊 Total processed: ${cards.length} cards`));
}

/**
 * Scrape all prices for a single card
 */
async function scrapeCardPrices(card: Card, date: Date): Promise<boolean> {
  try {
    logger.info(clc.blue(`\nProcessing: ${card.name} (${card.expName}) #${card.expCardNumber}`));

    // Parse variants
    let variants: string[] = [];
    if (card.variants) {
      try {
        variants = typeof card.variants === 'string' ? JSON.parse(card.variants) : card.variants;
      } catch (e) {
        variants = [];
      }
    }

    // Scrape all three prices concurrently
    const [raw, grade9, grade10] = await Promise.all([
      scrapeEbay(card, 'raw'),
      scrapeEbay(card, 'grade9'),
      scrapeEbay(card, 'grade10')
    ]);

    const variant = variants.length === 1 ? variants[0] : '';
    
    const price: Price = {
      date: date.toISOString(),
      cardId: card.cardId,
      variant: variant,
      rawPrice: raw,
      gradedPriceNine: grade9,
      gradedPriceTen: grade10
    };

    upsertPrice(price);
    logger.info(clc.green(`  ✓ ${card.name}: Raw $${raw.toFixed(2)} | PSA 9 $${grade9.toFixed(2)} | PSA 10 $${grade10.toFixed(2)}`));
    
    return true;
  } catch (error) {
    logger.error(clc.red(`  ✗ ${card.name}: ${error.message}`));
    return false;
  }
}

