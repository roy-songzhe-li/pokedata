import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { logger } from './common-lite.js';
import clc from 'cli-color';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dmsvsfsbytemtbbqxqyi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc3ZzZnNieXRlbXRiYnF4cXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTY0OTMsImV4cCI6MjA3ODc3MjQ5M30.kLZ8wlPlTdwfJW4NyXySdwEP70YfC3LZbSAsE6sJer8';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    logger.info(clc.cyan('Initializing Supabase client...'));
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    logger.info(clc.green('Supabase client initialized successfully'));
  }
  return supabaseClient;
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from('card_jp')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      logger.error(clc.red(`Supabase connection test failed: ${error.message}`));
      return false;
    }
    
    logger.info(clc.green(`✓ Supabase connection successful. Found ${count} cards in card_jp table.`));
    return true;
  } catch (error) {
    logger.error(clc.red(`Supabase connection error: ${error}`));
    return false;
  }
}

