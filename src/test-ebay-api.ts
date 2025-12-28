/**
 * Test eBay internal API endpoints
 */
import fetch from "node-fetch";

async function testEbayAPI() {
  // Try to find the internal API that loads sold listings
  const searchQuery = "Pikachu 024 Paradigm Trigger";
  
  // eBay's completed listings search (sold items)
  const urls = [
    // Sold listings URL
    `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&LH_Sold=1&LH_Complete=1&_sop=13`,
    
    // Try the browse API (might be JSON)
    `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(searchQuery)}&dayRange=30&endDate=1734220800000&startDate=1731542400000&categoryId=0&offset=0&limit=50&tabName=SOLD`,
  ];
  
  for (const url of urls) {
    console.log(`\n=== Testing URL ===`);
    console.log(url);
    
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/html',
        }
      });
      
      const contentType = resp.headers.get('content-type');
      console.log(`Status: ${resp.status}`);
      console.log(`Content-Type: ${contentType}`);
      
      if (contentType?.includes('json')) {
        const json = await resp.json();
        console.log('JSON Response:', JSON.stringify(json, null, 2).substring(0, 1000));
      } else {
        const text = await resp.text();
        console.log('Response preview:', text.substring(0, 500));
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
}

testEbayAPI().catch(console.error);

