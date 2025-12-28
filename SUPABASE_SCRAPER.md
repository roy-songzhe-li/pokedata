# Supabase Price Scraper - Japanese Cards

This is a refactored version of the price scraper that uses **Supabase** as the data source instead of local SQLite databases.

## Overview

The Supabase price scraper:
- ✅ Reads card data from your Supabase `card_jp` table
- ✅ Scrapes prices from eBay using the same logic as before
- ✅ Saves prices directly to Supabase `price_history` table
- ✅ Supports Japanese Pokemon TCG cards

## Architecture

```
Supabase card_jp → Price Scraper → eBay Search → Supabase price_history
```

### Key Files

- `src/supabase-client.ts` - Supabase client configuration
- `src/supabase-database.ts` - Database query functions
- `src/supabase-price-scrapper.ts` - Main scraper logic
- `src/scrappers/ebay-scrapper.ts` - eBay scraping (unchanged)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables (Optional)

Create a `.env` file or set environment variables:

```bash
export SUPABASE_URL=https://dmsvsfsbytemtbbqxqyi.supabase.co
export SUPABASE_ANON_KEY=your_anon_key_here
```

**Note:** Default values are already hardcoded in `supabase-client.ts` for convenience.

### 3. Build

```bash
npm run build
```

## Usage

### Test Mode - Scrape 5 Random Cards

```bash
node dist/supabase-price-scrapper.js --test
```

### Scrape Cards Needing Updates

Scrape cards with no prices or prices older than 7 days (default 100 cards):

```bash
node dist/supabase-price-scrapper.js
```

Custom parameters:

```bash
# Scrape 50 cards with prices older than 14 days
node dist/supabase-price-scrapper.js --limit=50 --days=14
```

### Scrape Rare Cards Only

```bash
node dist/supabase-price-scrapper.js --rare
```

This will scrape only:
- Ultra Rare
- Secret Rare
- Hyper Rare
- Special Illustration Rare
- Illustration Rare

### Scrape by Custom Rarity

```bash
node dist/supabase-price-scrapper.js --rarity="Ultra Rare,Secret Rare" --limit=50
```

### Verbose Logging

```bash
node dist/supabase-price-scrapper.js --verbose
```

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--test` | `-t` | `false` | Test mode: scrape 5 random cards |
| `--limit` | - | `100` | Max number of cards to scrape |
| `--days` | - | `7` | Days since last price update |
| `--rare` | `-r` | `false` | Scrape rare cards only |
| `--rarity` | - | `null` | Comma-separated list of rarities |
| `--verbose` | `-v` | `false` | Enable verbose logging |

## Data Flow

### 1. Query Cards from Supabase

The scraper queries `card_jp` table for cards that need price updates:

```sql
SELECT id, card_name, set_name, card_index, rarity
FROM card_jp
WHERE card_index IS NOT NULL
AND (
  id NOT IN (SELECT card_id FROM price_history)
  OR id IN (
    SELECT card_id FROM price_history
    WHERE date < NOW() - INTERVAL '7 days'
  )
)
LIMIT 100
```

### 2. Build eBay Search Queries

Card data is converted to search format:

- `card_name` → `name`
- `set_name` → `expName`
- `card_index` (e.g., "#003/009") → `expCardNumber` (e.g., "003")

Example eBay search:
```
(11th Movie Commemoration Set)+(Pikachu)+003 -PSA -BGS -CGC -Digital -Online
```

### 3. Scrape Prices

Three price points are scraped for each card:
- **Raw** (ungraded)
- **PSA 9**
- **PSA 10**

Prices are calculated as the **median** of all eBay listings found.

### 4. Save to Supabase

Results are saved to `price_history`:

```javascript
{
  card_id: 12,
  date: '2025-12-28',
  price_raw: 21.50,
  price_psa9: 45.00,
  price_psa10: 89.00,
  volume: 0,
  data_source: 'ebay'
}
```

## Database Schema

### card_jp

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| card_name | text | Card name (Japanese) |
| set_name | text | Set name |
| set_slug | text | URL-friendly set name |
| card_index | text | Card number (e.g., "#003/009") |
| rarity | text | Card rarity |
| image_urls | text | Card image URLs |
| product_slug | text | TCGPlayer product slug |
| product_id | text | TCGPlayer product ID |

### price_history

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| card_id | bigint | Foreign key → card_jp.id |
| date | date | Price date |
| price_raw | numeric | Raw (ungraded) price |
| price_psa9 | numeric | PSA 9 price |
| price_psa10 | numeric | PSA 10 price |
| volume | integer | Sales volume |
| data_source | text | Source (e.g., 'ebay') |
| created_at | timestamptz | Row creation time |
| updated_at | timestamptz | Last update time |

## Comparison with Original Scraper

| Feature | Original (SQLite) | New (Supabase) |
|---------|------------------|----------------|
| Data Source | Local SQLite files | Supabase cloud database |
| Card Data | `databases/data.sqlite` | `card_jp` table |
| Price Storage | `databases/prices.sqlite` | `price_history` table |
| Language Support | English + Japanese | **Japanese only** |
| eBay Scraping | ✅ | ✅ (same logic) |
| Dry Run Mode | ✅ | ❌ (not needed - test mode instead) |

## Troubleshooting

### "Failed to connect to Supabase"

Check your Supabase URL and anon key in `src/supabase-client.ts` or environment variables.

### "No cards found"

Make sure your `card_jp` table has cards with `card_index` values (not null).

### eBay Rate Limiting

The scraper adds a 1-second delay between cards to avoid rate limiting. If you still get rate limited, try reducing the `--limit` value.

### Compilation Errors

If you see TypeScript errors related to Supabase types, make sure `skipLibCheck: true` is in `tsconfig.json`.

## Future Enhancements

- [ ] Support for Best Buy price scraping (sealed products)
- [ ] Batch processing with better error recovery
- [ ] Price confidence scoring
- [ ] Email/Slack notifications on completion
- [ ] Retry logic for failed cards
- [ ] Support for other data sources (TCGPlayer, CardMarket)

## License

MIT

