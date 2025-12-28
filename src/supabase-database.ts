import { getSupabaseClient } from './supabase-client.js';
import { logger } from './common-lite.js';
import clc from 'cli-color';

/**
 * Card interface matching Supabase card_jp structure
 */
export interface SupabaseCard {
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

/**
 * Card formatted for price scraping (compatible with existing eBay scraper)
 */
export interface CardForPriceScraping {
  cardId: string;
  name: string;
  expName: string;
  expCardNumber: string;
  rarity: string;
  releaseDate?: string;
}

/**
 * Price history interface matching Supabase structure
 */
export interface PriceHistory {
  card_id: number;
  date: string;
  price_raw: number | null;
  price_psa9: number | null;
  price_psa10: number | null;
  volume?: number;
  data_source?: string;
}

/**
 * Get all cards from Supabase
 */
export async function getAllCards(limit: number = 1000): Promise<SupabaseCard[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('card_jp')
    .select('*')
    .limit(limit);
  
  if (error) {
    logger.error(clc.red(`Error fetching cards: ${error.message}`));
    return [];
  }
  
  return data || [];
}

/**
 * Get cards that need price updates
 * Cards with no price history or outdated prices
 */
export async function getCardsNeedingPriceUpdate(
  daysSinceLastUpdate: number = 7,
  limit: number = 100
): Promise<CardForPriceScraping[]> {
  const client = getSupabaseClient();
  
  // Calculate the date threshold
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysSinceLastUpdate);
  const dateStr = dateThreshold.toISOString().split('T')[0];
  
  logger.info(clc.cyan(`Fetching cards with no price data or prices older than ${dateStr}`));
  
  // First, get cards that have NO price history at all
  const { data: cardsWithoutPrices, error: error1 } = await client
    .from('card_jp')
    .select('id, card_name, set_name, card_index, rarity')
    .not('id', 'in', `(SELECT card_id FROM price_history)`)
    .not('card_index', 'is', null) // Only cards with card numbers
    .limit(limit);
  
  if (error1) {
    logger.error(clc.red(`Error fetching cards without prices: ${error1.message}`));
  }
  
  // Then, get cards with outdated prices
  const { data: cardsWithOldPrices, error: error2 } = await client
    .from('card_jp')
    .select(`
      id,
      card_name,
      set_name,
      card_index,
      rarity,
      price_history!inner(date)
    `)
    .not('card_index', 'is', null)
    .lt('price_history.date', dateStr)
    .limit(Math.max(0, limit - (cardsWithoutPrices?.length || 0)));
  
  if (error2) {
    logger.error(clc.red(`Error fetching cards with old prices: ${error2.message}`));
  }
  
  // Combine and convert to CardForPriceScraping format
  const allCards = [
    ...(cardsWithoutPrices || []),
    ...(cardsWithOldPrices || [])
  ];
  
  logger.info(clc.green(`Found ${allCards.length} cards needing price updates`));
  
  return allCards.map(card => convertToScrapingFormat(card));
}

/**
 * Get cards by rarity (for selective scraping)
 */
export async function getCardsByRarity(
  rarities: string[],
  limit: number = 100
): Promise<CardForPriceScraping[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('card_jp')
    .select('id, card_name, set_name, card_index, rarity')
    .in('rarity', rarities)
    .not('card_index', 'is', null)
    .limit(limit);
  
  if (error) {
    logger.error(clc.red(`Error fetching cards by rarity: ${error.message}`));
    return [];
  }
  
  return (data || []).map(card => convertToScrapingFormat(card));
}

/**
 * Get random sample of cards (for testing)
 */
export async function getRandomCards(count: number = 10): Promise<CardForPriceScraping[]> {
  const client = getSupabaseClient();
  
  // Get total count first
  const { count: totalCount } = await client
    .from('card_jp')
    .select('*', { count: 'exact', head: true })
    .not('card_index', 'is', null);
  
  if (!totalCount || totalCount === 0) {
    logger.warn(clc.yellow('No cards found in database'));
    return [];
  }
  
  // Get random offset
  const randomOffset = Math.floor(Math.random() * Math.max(0, totalCount - count));
  
  const { data, error } = await client
    .from('card_jp')
    .select('id, card_name, set_name, card_index, rarity')
    .not('card_index', 'is', null)
    .range(randomOffset, randomOffset + count - 1);
  
  if (error) {
    logger.error(clc.red(`Error fetching random cards: ${error.message}`));
    return [];
  }
  
  logger.info(clc.green(`Fetched ${data?.length || 0} random cards for testing`));
  return (data || []).map(card => convertToScrapingFormat(card));
}

/**
 * Convert Supabase card to format expected by eBay scraper
 */
function convertToScrapingFormat(card: any): CardForPriceScraping {
  // Extract card number from card_index
  // Format is like "#003/009" - we want just "003"
  let cardNumber = card.card_index || '';
  if (cardNumber.startsWith('#')) {
    cardNumber = cardNumber.substring(1);
  }
  if (cardNumber.includes('/')) {
    cardNumber = cardNumber.split('/')[0];
  }
  
  return {
    cardId: card.id.toString(),
    name: card.card_name,
    expName: card.set_name,
    expCardNumber: cardNumber,
    rarity: card.rarity || 'Unknown'
  };
}

/**
 * Insert price data into Supabase
 */
export async function insertPriceData(
  cardId: number,
  rawPrice: number,
  psa9Price: number,
  psa10Price: number,
  date: string = new Date().toISOString().split('T')[0]
): Promise<boolean> {
  const client = getSupabaseClient();
  
  const priceData: Partial<PriceHistory> = {
    card_id: cardId,
    date: date,
    price_raw: rawPrice > 0 ? rawPrice : null,
    price_psa9: psa9Price > 0 ? psa9Price : null,
    price_psa10: psa10Price > 0 ? psa10Price : null,
    volume: 0,
    data_source: 'ebay'
  };
  
  // Try to insert, if exists, update
  const { error } = await client
    .from('price_history')
    .upsert(priceData);
  
  if (error) {
    logger.error(clc.red(`Error inserting price data: ${error.message}`));
    return false;
  }
  
  logger.debug(clc.green(`✓ Price data saved for card ${cardId}`));
  return true;
}

/**
 * Get latest price for a card
 */
export async function getLatestPrice(cardId: number): Promise<PriceHistory | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('price_history')
    .select('*')
    .eq('card_id', cardId)
    .order('date', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    logger.debug(clc.yellow(`No price data found for card ${cardId}`));
    return null;
  }
  
  return data;
}

