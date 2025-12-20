#!/usr/bin/env node

import { v4 as uuidv4 } from 'uuid';

// Parse command line arguments
const args = process.argv.slice(2);
let count = 15; // Default count

// Parse -n argument for count
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-n' && args[i + 1]) {
    const parsedCount = parseInt(args[i + 1]);
    if (!isNaN(parsedCount) && parsedCount > 0) {
      count = parsedCount;
    }
    break;
  }
}
// Generate Shopware-compatible IDs (32-character hex strings without hyphens)
function generateShopwareId() {
    return uuidv4().replace(/-/g, '');
  }

// Generate and print UUIDs
for (let i = 0; i < count; i++) {
  const uuid = generateShopwareId();
  console.log(uuid);
}