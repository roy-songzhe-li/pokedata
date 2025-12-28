import * as jsdom from "jsdom";
import fetch from "node-fetch";
import * as fs from "fs";

const url = "https://www.ebay.com/sch/i.html?kw=(S12a:%20VSTAR%20Universe)+(Charizard%20VSTAR)%20014%20-PSA%20-BGS%20-CGC%20-Digital%20-Online&LH_BIN=1&_SOP=15";

async function debugEbayScraper() {
  console.log("Fetching URL:", url);
  
  const resp = await fetch(url);
  const data = await resp.text();
  
  // Save raw HTML
  fs.writeFileSync("./ebay-raw.html", data);
  console.log("✓ Saved raw HTML to ebay-raw.html");
  
  // Parse with jsdom
  const { window } = new jsdom.JSDOM(data);
  
  // Check s-item__info elements
  const listings = window.document.getElementsByClassName("s-item__info");
  console.log(`\n✓ Found ${listings.length} s-item__info elements`);
  
  // Check first few listings
  for (let i = 0; i < Math.min(5, listings.length); i++) {
    console.log(`\n--- Listing ${i + 1} ---`);
    
    const listing = listings[i];
    
    // Try to get price element
    const priceElements = listing.getElementsByClassName("s-item__price");
    console.log(`Price elements found: ${priceElements.length}`);
    
    if (priceElements.length > 0) {
      const priceHTML = priceElements[0].innerHTML;
      const priceText = priceElements[0].textContent;
      
      console.log(`Price innerHTML: ${priceHTML}`);
      console.log(`Price textContent: ${priceText}`);
      
      // Try regex
      const parts = [...priceHTML.matchAll(/(.*)\$(\d+\.\d{2})(.*)/g)];
      console.log(`Regex matches: ${parts.length}`);
      if (parts.length > 0) {
        console.log(`Extracted price: $${parts[0][2]}`);
      }
    }
    
    // Get title for reference
    const titleElements = listing.getElementsByClassName("s-item__title");
    if (titleElements.length > 0) {
      console.log(`Title: ${titleElements[0].textContent?.substring(0, 60)}...`);
    }
  }
}

debugEbayScraper().catch(console.error);

