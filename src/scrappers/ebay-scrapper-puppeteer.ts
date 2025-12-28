/**
 * eBay price scraper using Puppeteer (for JavaScript-rendered content)
 */
import puppeteer from 'puppeteer';
import { logger, formatCardName } from "../common-lite.js";
import clc from "cli-color";

const raw = "-PSA -BGS -CGC";
const grade10 = "(PSA 10,BGS 10,CGC 10)";
const grade9 = "(PSA 9,BGS 9,CGC 9)";
const ebayUrl = "https://www.ebay.com/sch/i.html";

let browser: any = null;

/**
 * Initialize browser (reused across requests)
 */
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ]
    });
    logger.info(clc.green('Puppeteer browser launched'));
  }
  return browser;
}

/**
 * Scrape eBay for price using Puppeteer
 * @param card Card object with name, expName, expCardNumber
 * @param type (raw|grade9|grade10)
 * @returns Median price from eBay listings
 */
export async function scrapeEbay(card: any, type: string): Promise<number> {
  const url = new URL(ebayUrl);
  const name = formatCardName(card.name);

  // Build search query
  let searchQuery = "";
  switch (type) {
    case "raw":
      searchQuery = `(${card.expName})+(${name})+${card.expCardNumber} ${raw} -Digital -Online`;
      break;
    case "grade9":
      searchQuery = `(${card.expName})+(${name})+${card.expCardNumber} +${grade9} -Digital -Online`;
      break;
    case "grade10":
      searchQuery = `(${card.expName})+(${name})+${card.expCardNumber} +${grade10} -Digital -Online`;
      break;
  }

  url.searchParams.set("kw", searchQuery);
  url.searchParams.set("LH_BIN", "1"); // Buy It Now only
  url.searchParams.set("_sop", "15"); // Sort by price + shipping: lowest first
  url.searchParams.set("LH_Sold", "1"); // Sold listings
  url.searchParams.set("LH_Complete", "1"); // Completed listings

  logger.info(`ebay ${type} search: ${searchQuery}`);
  logger.debug(`URL: ${url.toString()}`);

  try {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();

    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to page
    await page.goto(url.toString(), {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for results to load (with timeout)
    try {
      await page.waitForSelector('.srp-results', { timeout: 10000 });
    } catch (e) {
      logger.warn(clc.yellow(`No results container found for ${card.name}, ${type}`));
      await page.close();
      return 0;
    }

    // Extract prices from the page
    const prices = await page.evaluate(() => {
      const priceElements = document.querySelectorAll('.s-item__price');
      const extractedPrices: number[] = [];

      priceElements.forEach(el => {
        const text = el.textContent || '';
        // Match dollar amounts like "$12.34"
        const match = text.match(/\$(\d+\.\d{2})/);
        if (match) {
          const price = parseFloat(match[1]);
          if (!isNaN(price) && price > 0) {
            extractedPrices.push(price);
          }
        }
      });

      return extractedPrices;
    });

    await page.close();

    if (prices.length === 0) {
      logger.warn(clc.yellow(`Found no prices for ${card.name}, ${type}`));
      return 0;
    }

    // Remove outliers and calculate median
    prices.sort((a, b) => a - b);
    
    // Remove first element (often sponsored/featured)
    if (prices.length > 1) {
      prices.shift();
    }

    const midpoint = Math.floor(prices.length / 2);
    const medianPrice = prices[midpoint];

    logger.debug(clc.green(`Found ${prices.length} prices, median: $${medianPrice.toFixed(2)}`));
    return medianPrice;

  } catch (error) {
    logger.error(clc.red(`Failed to scrape eBay: ${error}`));
    return 0;
  }
}

/**
 * Close browser on exit
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info(clc.yellow('Puppeteer browser closed'));
  }
}

