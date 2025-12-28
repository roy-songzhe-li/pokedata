/**
 * Debug script to test eBay scraping
 */
import * as jsdom from "jsdom";
import fetch from "node-fetch";

const ebayUrl = "https://www.ebay.com/sch/i.html";

async function testEbayScrape() {
  const url = new URL(ebayUrl);
  const searchQuery = "(S12: Paradigm Trigger)+(Pikachu)+024 -PSA -BGS -CGC -Digital -Online";
  url.searchParams.set("kw", searchQuery);
  url.searchParams.set("LH_BIN", "1");
  url.searchParams.set("_SOP", "15");
  
  console.log("Testing URL:", url.toString());
  
  const resp = await fetch(url.toString());
  const html = await resp.text();
  
  const { window } = new jsdom.JSDOM(html);
  const document = window.document;
  
  // Try different selectors
  console.log("\n=== Testing selectors ===");
  
  const selectors = [
    ".s-item__info",
    ".s-item",
    "[class*='s-item']",
    ".srp-results .s-item",
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`\nSelector: ${selector}`);
    console.log(`Found ${elements.length} elements`);
    
    if (elements.length > 0 && elements.length < 5) {
      for (let i = 0; i < Math.min(elements.length, 2); i++) {
        console.log(`\nElement ${i} HTML preview:`);
        console.log(elements[i].innerHTML.substring(0, 500));
      }
    }
  }
  
  // Try to find price elements
  console.log("\n=== Looking for price elements ===");
  const priceSelectors = [
    ".s-item__price",
    "[class*='price']",
    ".x-price-primary",
  ];
  
  for (const selector of priceSelectors) {
    const priceElements = document.querySelectorAll(selector);
    console.log(`\nPrice selector: ${selector}`);
    console.log(`Found ${priceElements.length} elements`);
    
    if (priceElements.length > 0) {
      for (let i = 0; i < Math.min(priceElements.length, 3); i++) {
        console.log(`Price ${i}:`, priceElements[i].textContent?.trim());
      }
    }
  }
}

testEbayScrape().catch(console.error);

