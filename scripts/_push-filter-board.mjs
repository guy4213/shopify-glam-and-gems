import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DOMAIN   = "glam-and-gems-2.myshopify.com";
const TOKEN    = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const THEME_ID = "154724303038"; // Whiff — live

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const FILE   = 'snippets/collection-filter-board.liquid';
const value  = readFileSync(join(ROOT, FILE), 'utf8');

console.log(`\nUploading ${FILE} (${value.length} chars) to theme ${THEME_ID} [Whiff — live]...\n`);

const res = await fetch(
  `https://${DOMAIN}/admin/api/2025-04/themes/${THEME_ID}/assets.json`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ asset: { key: FILE, value } }),
  }
);

const json = await res.json();

if (!res.ok || json.errors) {
  console.error('❌  Failed:', json.errors ?? res.status);
  process.exit(1);
}

const asset = json.asset;
console.log('✅  Uploaded successfully.');
console.log(`    Key         : ${asset.key}`);
console.log(`    Size        : ${asset.size} bytes`);
console.log(`    Updated at  : ${asset.updated_at}`);
console.log(`    Theme       : ${asset.theme_id}\n`);
