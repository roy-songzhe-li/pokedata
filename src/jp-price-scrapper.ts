import minimist, { ParsedArgs } from 'minimist';
import * as fs from 'fs';
import * as cliProgress from 'cli-progress';
import { consoleHeader, logger, setUpLogger } from './common.js';
import { upsertPrice, useTestDbFile, getCardsByDate } from './database.js';
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
      months: 3
    }
  });

  setUpLogger(args.verbose);

  if (args.dryrun) {
    useTestDbFile(true);
    logger.info(clc.red.bold(`------------------ DRYRUN --------------------`));
    logger.info(clc.red.bold(`--------- Results at test-data.sql -----------`));
    logger.info(clc.red.bold(`------------------ DRYRUN --------------------`));
  }

  consoleHeader('🎌 Japanese Card Price Scraper - Historical Data');
  
  try {
    if (args.test) {
      await scrapeTestCards();
    } else {
      await scrapeHistoricalPrices(args.months, args.limit);
    }
  } finally {
    // Close Puppeteer browser
    await closeBrowser();
  }
}

/**
 * Scrape test cards (5 random Japanese cards)
 */
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
  await scrapePrices(cards);
}

/**
 * Scrape historical prices for Japanese cards
 * @param months Number of months of historical data to scrape
 * @param limit Maximum number of cards to scrape
 */
async function scrapeHistoricalPrices(months: number, limit: number) {
  logger.info(clc.cyan(`Scraping ${months} months of historical price data`));
  logger.info(clc.cyan(`Limit: ${limit} cards`));

  const db = new Database(DB_FILE);
  const priceDb = new Database(PRICE_DB_FILE);

  // Attach prices database to query across both databases
  db.prepare(`ATTACH DATABASE '${PRICE_DB_FILE}' AS priceDB`).run();

  // Get Japanese cards that don't have recent price data
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
  await scrapePrices(cards);
}

/**
 * Scrape prices for a list of cards
 */
async function scrapePrices(cards: Card[]) {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const date = new Date();

  bar.start(cards.length, 0);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    
    logger.info(clc.blue(`\n[${i + 1}/${cards.length}] Processing: ${card.name} (${card.expName}) #${card.expCardNumber}`));

    try {
      // Parse variants if it's a JSON string
      let variants: string[] = [];
      if (card.variants) {
        try {
          variants = typeof card.variants === 'string' ? JSON.parse(card.variants) : card.variants;
        } catch (e) {
          variants = [];
        }
      }

      // Scrape raw price
      logger.info('  → Scraping raw price...');
      const raw = await scrapeEbay(card, 'raw');
      
      // Scrape PSA 9 price
      logger.info('  → Scraping PSA 9 price...');
      const grade9 = await scrapeEbay(card, 'grade9');
      
      // Scrape PSA 10 price
      logger.info('  → Scraping PSA 10 price...');
      const grade10 = await scrapeEbay(card, 'grade10');

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
      logger.info(clc.green(`  ✓ Saved: Raw: $${raw.toFixed(2)} | PSA 9: $${grade9.toFixed(2)} | PSA 10: $${grade10.toFixed(2)}`));
      successCount++;

    } catch (error) {
      logger.error(clc.red(`  ✗ Error: ${error.message}`));
      errorCount++;
    }

    bar.update(i + 1);
  }

  bar.stop();

  consoleHeader('Summary');
  logger.info(clc.green(`✓ Successfully scraped: ${successCount} cards`));
  if (errorCount > 0) {
    logger.warn(clc.yellow(`⚠ Errors: ${errorCount} cards`));
  }
  logger.info(clc.blue(`📊 Total processed: ${cards.length} cards`));
}

