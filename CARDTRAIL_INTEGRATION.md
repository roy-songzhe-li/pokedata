# CardTrail Integration Guide

## 🎯 Overview

This guide shows how to integrate pokedata (Japanese card scraper) with CardTrail app.

## 📦 Project Structure

```
/Users/roy-songzhe-li/Desktop/Personal Projects/PTCG/
├── pokedata/                    # Card data scraper (this project)
│   ├── databases/
│   │   ├── data.sqlite         # Card metadata
│   │   └── prices.sqlite       # Price history
│   └── images/                  # Card images
└── cardtrail-app/               # Main application
    ├── packages/
    │   └── price-sync/         # Create this for integration
    └── supabase/
        └── migrations/
```

## 🚀 Quick Start

### Step 1: Scrape Japanese Data

```bash
cd /Users/roy-songzhe-li/Desktop/Personal\ Projects/PTCG/pokedata

# Scrape Japanese cards
node ./dist/data-scrapper.js --lang=jp -v

# Check results
sqlite3 databases/data.sqlite "SELECT COUNT(*) FROM cards WHERE language = 'jp';"
```

### Step 2: Create Price Sync Package

```bash
cd /Users/roy-songzhe-li/Desktop/Personal\ Projects/PTCG/cardtrail-app/packages
mkdir -p price-sync/src
cd price-sync
```

Create `package.json`:

```json
{
  "name": "@cardtrail/price-sync",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "sync": "tsx src/sync.ts",
    "sync:dry": "tsx src/sync.ts --dry-run"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "@supabase/supabase-js": "^2.45.1",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.6.3"
  }
}
```

### Step 3: Create Sync Script

Create `src/sync.ts`:

```typescript
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const POKEDATA_PATH = '/Users/roy-songzhe-li/Desktop/Personal Projects/PTCG/pokedata';
const pokedataDb = new Database(`${POKEDATA_PATH}/databases/data.sqlite`, { readonly: true });
const pricesDb = new Database(`${POKEDATA_PATH}/databases/prices.sqlite`, { readonly: true });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for bulk operations
);

interface PokedataCard {
  cardId: string;
  name: string;
  expName: string;
  expCardNumber: string;
  rarity: string;
  img: string;
  price: number;
  releaseDate: string;
  language: string;
}

interface PokedataPrice {
  cardId: string;
  date: string;
  rawPrice: number;
  gradedPriceNine: number;
  gradedPriceTen: number;
}

async function syncCards() {
  console.log('📦 Syncing Japanese cards from pokedata...');
  
  // Get Japanese cards
  const cards = pokedataDb.prepare(`
    SELECT cardId, name, expName, expCardNumber, rarity, img, price, releaseDate, language
    FROM cards 
    WHERE language = 'jp'
    LIMIT 1000
  `).all() as PokedataCard[];
  
  console.log(`Found ${cards.length} Japanese cards`);
  
  // Batch insert to Supabase
  for (let i = 0; i < cards.length; i += 100) {
    const batch = cards.slice(i, i + 100);
    
    const supabaseCards = batch.map(card => ({
      // Map pokedata schema to CardTrail card_jp schema
      card_name: card.name,
      set_name: card.expName,
      card_index: card.expCardNumber,
      rarity: card.rarity,
      image_urls: card.img,
      // Add other fields as needed
    }));
    
    const { error } = await supabase
      .from('card_jp')
      .upsert(supabaseCards, { onConflict: 'card_name,set_name' });
    
    if (error) {
      console.error(`Error syncing batch ${i}-${i+100}:`, error);
    } else {
      console.log(`✅ Synced ${i}-${i+100}`);
    }
  }
}

async function syncPrices() {
  console.log('💰 Syncing price history...');
  
  // Get recent prices (last 30 days)
  const prices = pricesDb.prepare(`
    SELECT cardId, date, rawPrice, gradedPriceNine, gradedPriceTen
    FROM prices
    WHERE date > date('now', '-30 days')
    ORDER BY date DESC
  `).all() as PokedataPrice[];
  
  console.log(`Found ${prices.length} price records`);
  
  // TODO: Map cardId from pokedata to card_jp.id
  // This requires a mapping table or matching logic
  
  for (let i = 0; i < prices.length; i += 100) {
    const batch = prices.slice(i, i + 100);
    
    const supabasePrices = batch.map(price => ({
      // card_id: mapCardId(price.cardId), // Need mapping logic
      date: price.date,
      price_raw: price.rawPrice,
      price_psa9: price.gradedPriceNine,
      price_psa10: price.gradedPriceTen,
      data_source: 'pokedata',
    }));
    
    // Uncomment when mapping is ready
    // const { error } = await supabase
    //   .from('price_history')
    //   .upsert(supabasePrices);
    
    console.log(`✅ Prepared batch ${i}-${i+100}`);
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No data will be written\n');
  }
  
  try {
    if (!isDryRun) {
      await syncCards();
      await syncPrices();
    } else {
      console.log('Would sync cards and prices...');
    }
    
    console.log('\n✅ Sync completed!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    pokedataDb.close();
    pricesDb.close();
  }
}

main();
```

### Step 4: Install Dependencies

```bash
cd /Users/roy-songzhe-li/Desktop/Personal\ Projects/PTCG/cardtrail-app/packages/price-sync
pnpm install
```

### Step 5: Configure Environment

Add to `cardtrail-app/.env`:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### Step 6: Run Sync

```bash
# Dry run first
pnpm sync:dry

# Real sync
pnpm sync
```

## 🗂️ Data Mapping

### Card Schema Mapping

| pokedata | CardTrail card_jp | Notes |
|----------|-------------------|-------|
| `cardId` | - | Internal ID, not used |
| `name` | `card_name` | Direct mapping |
| `expName` | `set_name` | Direct mapping |
| `expCardNumber` | `card_index` | Direct mapping |
| `rarity` | `rarity` | Direct mapping |
| `img` | `image_urls` | May need format conversion |
| `price` | - | Goes to `card_extensions` |
| `releaseDate` | - | Not in card_jp |
| `language` | - | Filter for 'jp' only |

### Price Schema Mapping

| pokedata prices | CardTrail price_history |
|-----------------|-------------------------|
| `cardId` | `card_id` (needs mapping) |
| `date` | `date` |
| `rawPrice` | `price_raw` |
| `gradedPriceNine` | `price_psa9` |
| `gradedPriceTen` | `price_psa10` |

## 🔄 Automated Sync

### Option 1: Cron Job

```bash
# Add to crontab
0 2 * * * cd /path/to/pokedata && node dist/data-scrapper.js --lang=jp -v
0 3 * * * cd /path/to/cardtrail-app/packages/price-sync && pnpm sync
```

### Option 2: GitHub Actions

Create `.github/workflows/sync-prices.yml` in cardtrail-app:

```yaml
name: Sync Prices from Pokedata

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
      
      - name: Clone pokedata
        run: git clone https://github.com/roy-songzhe-li/pokedata.git
      
      - name: Scrape Japanese data
        run: |
          cd pokedata
          npm install
          npm run build
          node dist/data-scrapper.js --lang=jp -v
      
      - name: Sync to Supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          cd packages/price-sync
          pnpm install
          pnpm sync
```

## 📊 Monitoring

### Check Sync Status

```sql
-- In Supabase SQL Editor

-- Count synced cards
SELECT COUNT(*) FROM card_jp;

-- Recent price updates
SELECT date, COUNT(*) as records
FROM price_history
WHERE data_source = 'pokedata'
GROUP BY date
ORDER BY date DESC
LIMIT 7;

-- Cards without prices
SELECT c.id, c.card_name
FROM card_jp c
LEFT JOIN price_history p ON c.id = p.card_id
WHERE p.id IS NULL
LIMIT 10;
```

## 🐛 Troubleshooting

### Issue: Card ID Mismatch

**Problem**: pokedata cardId doesn't match card_jp.id

**Solution**: Create mapping table or use (card_name + set_name) as composite key

### Issue: Image URL Format Different

**Problem**: pokedata uses single URL, card_jp uses srcset format

**Solution**: Convert in sync script:

```typescript
function convertImageUrl(url: string): string {
  // Convert single URL to srcset format
  return `${url}|${url} 200w,${url.replace('200x200', '400x400')} 400w`;
}
```

### Issue: Duplicate Cards

**Problem**: Same card synced multiple times

**Solution**: Use `upsert` with proper conflict resolution:

```typescript
await supabase
  .from('card_jp')
  .upsert(cards, { 
    onConflict: 'card_name,set_name',
    ignoreDuplicates: false 
  });
```

## 📚 Next Steps

1. ✅ Fork and modify pokedata
2. ✅ Add language support
3. ⏳ Create price-sync package
4. ⏳ Implement card ID mapping
5. ⏳ Set up automated sync
6. ⏳ Add monitoring dashboard

## 🔗 Resources

- [Pokedata Repository](https://github.com/roy-songzhe-li/pokedata)
- [CardTrail Documentation](../README.md)
- [Supabase Docs](https://supabase.com/docs)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)

