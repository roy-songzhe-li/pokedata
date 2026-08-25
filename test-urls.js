import Database from 'better-sqlite3';

const DB_FILE = './databases/data.sqlite';
const db = new Database(DB_FILE);

// Get 3 sample cards
const cards = db.prepare(`
  SELECT * FROM cards 
  WHERE language = 'jp' 
  AND expCardNumber IS NOT NULL 
  AND expCardNumber != ''
  ORDER BY RANDOM() 
  LIMIT 3
`).all();

db.close();

// Build URLs
const raw = "-PSA -BGS -CGC";
const grade10 = "(PSA 10,BGS 10,CGC 10)";
const grade9 = "(PSA 9,BGS 9,CGC 9)";
const ebayUrl = "https://www.ebay.com/sch/i.html";

cards.forEach((card, i) => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`卡片 ${i + 1}: ${card.name} (${card.expName}) #${card.expCardNumber}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const name = card.name.replace(/\(.+\)/, ""); // Remove parentheses
  
  // Raw URL
  const rawQuery = `(${card.expName})+(${name})+${card.expCardNumber} ${raw} -Digital -Online`;
  const rawUrl = new URL(ebayUrl);
  rawUrl.searchParams.set("kw", rawQuery);
  rawUrl.searchParams.set("LH_BIN", "1");
  rawUrl.searchParams.set("LH_Sold", "1");
  rawUrl.searchParams.set("LH_Complete", "1");
  rawUrl.searchParams.set("_sop", "12");
  
  console.log(`\n📦 Raw (原卡) - Sold Listings:`);
  console.log(rawUrl.toString());
  
  // PSA 10 URL
  const grade10Query = `(${card.expName})+(${name})+${card.expCardNumber} +${grade10} -Digital -Online`;
  const grade10Url = new URL(ebayUrl);
  grade10Url.searchParams.set("kw", grade10Query);
  grade10Url.searchParams.set("LH_BIN", "1");
  grade10Url.searchParams.set("LH_Sold", "1");
  grade10Url.searchParams.set("LH_Complete", "1");
  grade10Url.searchParams.set("_sop", "12");
  
  console.log(`\n💎 PSA 10 - Sold Listings:`);
  console.log(grade10Url.toString());
});

console.log(`\n\n✅ URL参数说明:`);
console.log(`LH_BIN=1         → 只显示"立即购买"(Buy It Now)`);
console.log(`LH_Sold=1        → 只显示已售出商品 ✓`);
console.log(`LH_Complete=1    → 完成的交易 ✓`);
console.log(`_sop=12          → 按结束时间排序`);
