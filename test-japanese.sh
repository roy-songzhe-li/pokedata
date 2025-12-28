#!/bin/bash

# Test Japanese card scraping
echo "🇯🇵 Testing Japanese Card Scraping..."
echo ""

# Run dry run test
echo "Running dry run test..."
node ./dist/data-scrapper.js --lang=jp -d -f -v

echo ""
echo "✅ Test completed!"
echo ""
echo "Check results:"
echo "  sqlite3 test-data.sqlite \"SELECT COUNT(*), language FROM expansions GROUP BY language;\""
echo "  sqlite3 test-data.sqlite \"SELECT name, language FROM expansions LIMIT 5;\""

