import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { logger, setUpLogger } from './common.js';
import clc from 'cli-color';
import minimist from 'minimist';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dmsvsfsbytemtbbqxqyi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc3ZzZnNieXRlbXRiYnF4cXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTY0OTMsImV4cCI6MjA3ODc3MjQ5M30.kLZ8wlPlTdwfJW4NyXySdwEP70YfC3LZbSAsE6sJer8';

const DB_FILE = './databases/data.sqlite';

interface SupabaseCard {
  id: number;
  card_name: string;
  set_name: string;
  set_slug: string;
  card_index: string | null;
  rarity: string | null;
  image_urls: string | null;
  product_slug: string | null;
  product_id: string | null;
}

async function exportJapaneseCards() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['verbose', 'clear'],
    alias: {
      v: 'verbose',
      c: 'clear'
    }
  });

  setUpLogger(args.verbose);

  logger.info(clc.cyan('----------------------------------------------'));
  logger.info(clc.cyan('🎌 Export Japanese Cards from Supabase to SQLite'));
  logger.info(clc.cyan('----------------------------------------------'));

  // Initialize Supabase client
  logger.info('Initializing Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  logger.info(clc.green('✓ Supabase client initialized'));

  // Open local SQLite database
  logger.info('Opening local SQLite database...');
  const db = new Database(DB_FILE);
  logger.info(clc.green('✓ Database opened'));

  // Clear existing Japanese cards if requested
  if (args.clear) {
    logger.info(clc.yellow('Clearing existing Japanese cards...'));
    const result = db.prepare("DELETE FROM cards WHERE language = 'jp'").run();
    logger.info(clc.yellow(`✓ Deleted ${result.changes} existing Japanese cards`));
  }

  // Fetch all cards from Supabase (paginated)
  logger.info('Fetching cards from Supabase card_jp table...');
  let allCards: SupabaseCard[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('card_jp')
      .select('*')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.error(clc.red(`✗ Error fetching cards: ${error.message}`));
      process.exit(1);
    }

    if (!cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    allCards = allCards.concat(cards as SupabaseCard[]);
    logger.info(clc.blue(`  Fetched page ${page + 1}: ${cards.length} cards (total: ${allCards.length})`));
    
    if (cards.length < pageSize) {
      hasMore = false;
    }
    page++;
  }

  if (allCards.length === 0) {
    logger.warn(clc.yellow('No cards found in Supabase'));
    process.exit(0);
  }

  logger.info(clc.green(`✓ Fetched ${allCards.length} cards from Supabase`));
  const cards = allCards;

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO cards (
      cardId, idTCGP, name, expIdTCGP, expName, expCardNumber, 
      expCodeTCGP, rarity, img, price, description, releaseDate, 
      energyType, cardType, variants, language
    ) VALUES (
      @cardId, @idTCGP, @name, @expIdTCGP, @expName, @expCardNumber,
      @expCodeTCGP, @rarity, @img, @price, @description, @releaseDate,
      @energyType, @cardType, @variants, @language
    )
  `);

  // Process and insert cards
  logger.info('Inserting cards into local database...');
  let successCount = 0;
  let errorCount = 0;

  for (const card of cards as SupabaseCard[]) {
    try {
      // Extract card number from card_index (e.g., "#003/009" -> "003")
      let cardNumber = '';
      if (card.card_index) {
        const match = card.card_index.match(/#?(\d+)/);
        if (match) {
          cardNumber = match[1];
        }
      }

      // Extract first image URL
      let imageUrl = '';
      if (card.image_urls) {
        const urls = card.image_urls.split('|');
        if (urls.length > 0) {
          imageUrl = urls[0];
        }
      }

      // Create cardId in format: SetName-CardName-CardNumber
      const cardId = `${card.set_name}-${card.card_name}-${cardNumber}`.replace(/\s+/g, '-');

      insertStmt.run({
        cardId: cardId,
        idTCGP: card.product_id ? parseInt(card.product_id) : null,
        name: card.card_name,
        expIdTCGP: card.set_slug,
        expName: card.set_name,
        expCardNumber: cardNumber,
        expCodeTCGP: card.set_slug,
        rarity: card.rarity || 'Unknown',
        img: imageUrl,
        price: null,
        description: null,
        releaseDate: null,
        energyType: null,
        cardType: null,
        variants: '[]',
        language: 'jp'
      });

      successCount++;

      if (successCount % 1000 === 0) {
        logger.info(clc.blue(`  Processed ${successCount}/${cards.length} cards...`));
      }
    } catch (error) {
      errorCount++;
      logger.error(clc.red(`✗ Error inserting card ${card.id}: ${error.message}`));
    }
  }

  db.close();

  logger.info(clc.cyan('----------------------------------------------'));
  logger.info(clc.cyan('Summary'));
  logger.info(clc.cyan('----------------------------------------------'));
  logger.info(clc.green(`✓ Successfully inserted: ${successCount} cards`));
  if (errorCount > 0) {
    logger.warn(clc.yellow(`⚠ Errors: ${errorCount} cards`));
  }
  logger.info(clc.blue(`📊 Total processed: ${cards.length} cards`));
  logger.info(clc.cyan('----------------------------------------------'));
}

exportJapaneseCards().catch((error) => {
  logger.error(clc.red(`Fatal error: ${error.message}`));
  process.exit(1);
});

