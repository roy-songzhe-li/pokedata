# Japanese Cards Price Scraping Workflow

This document explains the workflow for exporting Japanese cards from Supabase and scraping their prices.

## Overview

The workflow consists of two main steps:
1. **Export Japanese cards** from Supabase `card_jp` table to local SQLite database
2. **Scrape prices** for Japanese cards using eBay

## Prerequisites

- Node.js and npm installed
- Supabase database with `card_jp` table populated
- Local SQLite databases: `databases/data.sqlite` and `databases/prices.sqlite`

## Step 1: Export Japanese Cards from Supabase

This step fetches all cards from your Supabase `card_jp` table and inserts them into the local SQLite database with `language = 'jp'`.

### Command

```bash
npm run export:jp -- --clear
```

### Options

- `--clear` or `-c`: Clear existing Japanese cards before importing (recommended for fresh import)
- `--verbose` or `-v`: Enable verbose logging

### What it does

1. Connects to Supabase using the configured credentials
2. Fetches all cards from `card_jp` table (paginated, 1000 per page)
3. Transforms the data to match the local database schema:
   - `card_name` → `name`
   - `set_name` → `expName`
   - `card_index` (e.g., "#003/009") → `expCardNumber` (e.g., "003")
   - `product_id` → `idTCGP`
   - Sets `language = 'jp'` for all cards
4. Inserts cards into local `cards` table using `INSERT OR REPLACE`

### Example Output

```
✓ Fetched 28154 cards from Supabase
✓ Successfully inserted: 28154 cards
```

## Step 2: Scrape Prices for Japanese Cards

This step scrapes historical price data for Japanese cards from eBay.

### Test Mode (5 random cards)

```bash
npm run price:jp:test
```

### Full Scraping

```bash
# Scrape 100 cards (default) with 3 months history
npm run price:jp

# Custom parameters
npm run price:jp -- --limit=50 --months=6
```

### Options

- `--test` or `-t`: Test mode - scrape 5 random Japanese cards
- `--limit=N`: Maximum number of cards to scrape (default: 100)
- `--months=N`: Number of months of historical data (default: 3)
- `--verbose` or `-v`: Enable verbose logging
- `--dryrun` or `-d`: Dry run mode - use test database

### What it does

1. Queries Japanese cards from local database that need price updates
2. For each card, scrapes three price points from eBay:
   - **Raw** (ungraded)
   - **PSA 9**
   - **PSA 10**
3. Saves prices to `databases/prices.sqlite`

### Price Query Logic

The scraper finds cards that:
- Have `language = 'jp'`
- Have a valid `expCardNumber` (not null or empty)
- Don't have price data from the last N months

### Example Output

```
Found 10 cards needing price updates

[1/10] Processing: Pikachu (151) #025
  → Scraping raw price...
  → Scraping PSA 9 price...
  → Scraping PSA 10 price...
  ✓ Saved: Raw: $2.50 | PSA 9: $15.00 | PSA 10: $45.00

✓ Successfully scraped: 10 cards
```

## Complete Workflow Example

```bash
# 1. Export Japanese cards from Supabase
npm run export:jp -- --clear

# 2. Test the price scraper with 5 random cards
npm run price:jp:test

# 3. Scrape prices for 100 cards (3 months history)
npm run price:jp

# 4. Scrape more cards with custom parameters
npm run price:jp -- --limit=200 --months=6
```

## Database Schema

### Local SQLite - cards table

```sql
CREATE TABLE cards (
  cardId TEXT UNIQUE,
  idTCGP INTEGER NULL,
  name TEXT,
  expIdTCGP TEXT NULL,
  expName TEXT,
  expCardNumber TEXT,
  expCodeTCGP TEXT,
  rarity TEXT,
  img TEXT,
  price FLOAT,
  description TEXT NULL,
  releaseDate TEXT NULL,
  energyType TEXT NULL,
  cardType TEXT NULL,
  pokedex INTEGER NULL,
  variants TEXT NULL,
  variantMap TEXT,
  language TEXT DEFAULT 'en'
);
```

### Local SQLite - prices table

```sql
CREATE TABLE prices (
  date TEXT,
  cardId TEXT,
  variant TEXT,
  rawPrice REAL,
  gradedPriceTen REAL,
  gradedPriceNine REAL
);
```

## Verification

### Check Japanese cards count

```bash
sqlite3 databases/data.sqlite "SELECT COUNT(*) FROM cards WHERE language = 'jp'"
```

### Check recent prices

```bash
sqlite3 databases/prices.sqlite "SELECT COUNT(*) FROM prices WHERE date >= date('now', '-1 day')"
```

### View sample data

```bash
# View 5 Japanese cards
sqlite3 databases/data.sqlite "SELECT cardId, name, expName, expCardNumber FROM cards WHERE language = 'jp' LIMIT 5"

# View recent prices
sqlite3 databases/prices.sqlite "SELECT * FROM prices ORDER BY date DESC LIMIT 5"
```

## Troubleshooting

### "No cards found in Supabase"

- Check your Supabase connection credentials in `src/export-jp-cards.ts`
- Verify that your `card_jp` table has data

### "No cards need price updates"

- All cards already have recent price data
- Try increasing the `--months` parameter
- Use `--test` mode to scrape random cards regardless of existing prices

### eBay rate limiting

- The scraper includes a 1-second delay between cards
- If you encounter rate limiting, reduce the `--limit` parameter
- Consider running the scraper in smaller batches

### Better-sqlite3 build errors

If you see errors related to better-sqlite3 native bindings:

```bash
npm rebuild better-sqlite3
```

## Files

- `src/export-jp-cards.ts` - Supabase to SQLite export script
- `src/jp-price-scrapper.ts` - Japanese cards price scraper
- `src/scrappers/ebay-scrapper.ts` - eBay scraping logic (shared)
- `databases/data.sqlite` - Card data database
- `databases/prices.sqlite` - Price history database

## Notes

- The export script uses `INSERT OR REPLACE` to handle duplicate cards
- Price scraping is rate-limited to avoid eBay blocking
- Cards without eBay listings will have $0.00 prices
- The scraper focuses on cards with valid card numbers for better eBay search results

