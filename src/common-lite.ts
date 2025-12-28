/**
 * Lightweight common utilities without database dependencies
 * Used by Supabase-based scripts to avoid SQLite dependencies
 */
import clc from 'cli-color';
import { CategoryProvider, Category } from "typescript-logging-category-style";
import { LogLevel } from 'typescript-logging';

let provider: CategoryProvider;
export let logger: Category;

export function delay(ms: number) { 
  return new Promise(_ => setTimeout(_, ms)); 
}

export function consoleHeader(msg: string) {
  logger.info(clc.blueBright.bold("----------------------------------------------"));
  logger.info(clc.blueBright.bold(msg));
  logger.info(clc.blueBright.bold("----------------------------------------------"));
}

export function setUpLogger(verbose: boolean) {
  if (provider) return;
  if (verbose) {
    provider = CategoryProvider.createProvider("Pokedata", { level: LogLevel.Debug });
  } else {
    provider = CategoryProvider.createProvider("Pokedata", { level: LogLevel.Info });
  }
  logger = provider.getCategory("root");
}

/**
 * Format card name for eBay search
 * Removes special characters that might interfere with search
 */
export function formatCardName(name: string): string {
  return name
    .replace(/[éÉ]/g, 'e')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
    .replace(/[^\w\s-]/g, '') // Remove special chars except dash
    .trim();
}

