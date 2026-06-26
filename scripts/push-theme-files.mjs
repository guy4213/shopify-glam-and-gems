/**
 * push-theme-files.mjs
 *
 * Pushes a list of local theme files to the live Shopify theme via the REST Assets API.
 * Usage:  node scripts/push-theme-files.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DOMAIN   = 'glam-and-gems-2.myshopify.com';
const TOKEN    = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const THEME_ID = '154724303038';
const BASE_URL = `https://${DOMAIN}/admin/api/2025-04/themes/${THEME_ID}/assets.json`;

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');

const FILES = [
  'templates/collection.json',
  'sections/main-collection-product-grid.liquid',
  'snippets/facets.liquid',
];

async function pushFile(key) {
  const value = readFileSync(join(ROOT, key), 'utf8');
  process.stdout.write(`  Uploading ${key} (${value.length} chars)… `);

  const res = await fetch(BASE_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ asset: { key, value } }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    console.error(`\n  ❌  Failed: ${JSON.stringify(json.errors ?? res.status)}`);
    return false;
  }
  console.log(`✅  ${json.asset.size} bytes  (${json.asset.updated_at})`);
  return true;
}

console.log('\n' + '═'.repeat(60));
console.log('  Push Theme Files → Whiff [live]');
console.log(`  Theme ID: ${THEME_ID}`);
console.log('═'.repeat(60) + '\n');

let ok = 0;
for (const file of FILES) {
  const success = await pushFile(file);
  if (success) ok++;
}

console.log('\n' + '═'.repeat(60));
console.log(`  ${ok}/${FILES.length} files uploaded successfully`);
console.log('═'.repeat(60) + '\n');
