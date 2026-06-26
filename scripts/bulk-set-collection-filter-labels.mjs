/**
 * bulk-set-collection-filter-labels.mjs
 *
 * Sets visual_filter_label_1-4 and quick_filter_1-4 metafields on every
 * product collection in the store. Collections that already have
 * visual_filter_label_1 set are skipped — their config is preserved.
 *
 * Logic:
 *   - Top-level categories  → Diamond Shape / Style / Metal / Price (where relevant)
 *   - Style sub-collections → Diamond Shape / Metal / Price
 *   - Shape sub-collections → Style / Metal / Price  (already filtered by shape)
 *   - Accessories           → Style or Metal / Price
 *
 * Usage:
 *   node scripts/bulk-set-collection-filter-labels.mjs
 */

const DOMAIN      = 'glam-and-gems-2.myshopify.com';
const TOKEN       = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION = '2025-04';
const GQL         = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hr(c = '━', n = 58) { console.log(c.repeat(n)); }

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data;
}

// ─── CONFIG MAP ───────────────────────────────────────────────────────────────
// l1-l4 : visual_filter_label_1-4  (blank string = don't set that slot)
// q     : [quick_filter_1, quick_filter_2, quick_filter_3, quick_filter_4]
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {

  // ── Top-level categories ────────────────────────────────────────────────────
  'engagement-rings':   { l1:'Diamond Shape', l2:'Style',  l3:'Metal', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'wedding-rings':      { l1:'Style',  l2:'Metal', l3:'Diamond Shape', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'necklaces-pendants': { l1:'Style',  l2:'Metal', l3:'Diamond Shape', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'earrings':           { l1:'Style',  l2:'Metal', l3:'Diamond Shape', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'bracelets':          { l1:'Style',  l2:'Metal', l3:'Diamond Shape', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'fashion-rings':      { l1:'Style',  l2:'Metal', l3:'Diamond Shape', l4:'Price', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },

  // ── Engagement rings — by style (Diamond Shape is the key variable) ─────────
  'solitaire-engagement-rings':     { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'three-stone-engagement-rings':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'double-halo-engagement-rings':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'hidden-halo-engagement-rings':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'bridal-set-engagement-rings':    { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'side-diamonds-engagement-rings': { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },

  // ── Engagement rings — by shape (Style is the key variable) ────────────────
  'round-engagement-rings':          { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'oval-engagement-rings':           { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'pear-engagement-rings':           { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'cushion-engagement-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'princess-engagement-rings':       { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'marquise-engagement-rings':       { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'radiant-engagement-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'asscher-engagement-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'heart-engagement-rings':          { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'square-cushion-engagement-rings': { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },

  // ── Wedding rings — by style ────────────────────────────────────────────────
  'eternity-rings':             { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'half-eternity-rings':        { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'classic-bands':              { l1:'Style',  l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'bezel-wedding-rings':        { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'contoured-rings':            { l1:'Metal',  l2:'Price', l3:'',    l4:'', q:['Ready To Ship','On Sale','',''] },
  'side-diamond-wedding-rings': { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'special-wedding-rings':      { l1:'Style',  l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Wedding rings — by shape ────────────────────────────────────────────────
  'round-wedding-rings':          { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'oval-wedding-rings':           { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'radiant-wedding-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'pear-wedding-rings':           { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'cushion-wedding-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'marquise-wedding-rings':       { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'princess-wedding-rings':       { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'asscher-wedding-rings':        { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'heart-wedding-rings':          { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'square-cushion-wedding-rings': { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Earrings — by style ─────────────────────────────────────────────────────
  'studs':             { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'hoop-earrings':     { l1:'Style',  l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'dangle-earrings':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'chain-earrings':    { l1:'Metal',  l2:'Price', l3:'',    l4:'', q:['Ready To Ship','On Sale','',''] },
  'ear-cuff-earrings': { l1:'Metal',  l2:'Price', l3:'',    l4:'', q:['Ready To Ship','On Sale','',''] },
  'halo-earrings':     { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'bouquet-earrings':  { l1:'Metal',  l2:'Price', l3:'',    l4:'', q:['Ready To Ship','On Sale','',''] },
  'bezel-earrings':    { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Earrings — by shape ─────────────────────────────────────────────────────
  'oval-earrings':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'pear-earrings':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'round-earrings':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'radiant-earrings':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'marquise-earrings': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'cushion-earrings':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'princess-earrings': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'asscher-earrings':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'heart-earrings':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Necklaces ───────────────────────────────────────────────────────────────
  'tennis-necklaces':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'solitaire-pendants': { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'chain-necklaces':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'choker-necklaces':   { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'bezel-necklaces':    { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'special-necklaces':  { l1:'Style', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'charm-necklaces':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'oval-necklaces':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'pear-necklaces':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'round-necklaces':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'radiant-necklaces':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'marquise-necklaces': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'cushion-necklaces':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'princess-necklaces': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Bracelets ───────────────────────────────────────────────────────────────
  'tennis-bracelets':   { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'cuff-bracelets':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'bangle-bracelets':   { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'chain-bracelets':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'charm-bracelets':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'bezel-bracelets':    { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'pear-bracelets':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'round-bracelets':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'radiant-bracelets':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'marquise-bracelets': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'cushion-bracelets':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'princess-bracelets': { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'asscher-bracelets':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'heart-bracelets':    { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },

  // ── Fashion rings ───────────────────────────────────────────────────────────
  'eternity-fashion-rings':  { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','New Arrival','Best Sellers'] },
  'stacking-rings':          { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','New Arrival',''] },
  'toi-moi-rings':           { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'signet-rings':            { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'halo-fashion-rings':      { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'bezel-fashion-rings':     { l1:'Diamond Shape', l2:'Metal', l3:'Price', l4:'', q:['Ready To Ship','On Sale','',''] },
  'oval-fashion-rings':      { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'round-fashion-rings':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'radiant-fashion-rings':   { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'marquise-fashion-rings':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'cushion-fashion-rings':   { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'princess-fashion-rings':  { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'asscher-fashion-rings':   { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
  'heart-fashion-rings':     { l1:'Metal', l2:'Price', l3:'', l4:'', q:['Ready To Ship','On Sale','',''] },
};

// ─── Step 1: fetch all collections with their current metafields ──────────────

const COLLECTIONS_QUERY = `
  query FetchCollections($cursor: String) {
    collections(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          metafields(first: 1, keys: ["custom.visual_filter_label_1"]) {
            edges { node { key value } }
          }
        }
      }
    }
  }
`;

async function fetchAllCollections() {
  const all = [];
  let cursor = null;
  do {
    const data = await gql(COLLECTIONS_QUERY, { cursor });
    for (const { node } of data.collections.edges) {
      const mfs = node.metafields.edges.map(e => e.node);
      const alreadySet = mfs.some(m => m.key === 'visual_filter_label_1' && m.value?.trim());
      all.push({ id: node.id, handle: node.handle, title: node.title, alreadySet });
    }
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

// ─── Step 2: set metafields for one collection ────────────────────────────────

const METAFIELDS_SET = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message code }
    }
  }
`;

function buildMetafields(ownerId, cfg) {
  const entries = [];
  const add = (key, value) => {
    if (value?.trim()) {
      entries.push({ ownerId, namespace: 'custom', key, type: 'single_line_text_field', value });
    }
  };
  add('visual_filter_label_1', cfg.l1);
  add('visual_filter_label_2', cfg.l2);
  add('visual_filter_label_3', cfg.l3);
  add('visual_filter_label_4', cfg.l4);
  add('quick_filter_1', cfg.q[0]);
  add('quick_filter_2', cfg.q[1]);
  add('quick_filter_3', cfg.q[2]);
  add('quick_filter_4', cfg.q[3]);
  return entries;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  hr();
  console.log('  Bulk Collection Filter Labels');
  console.log(`  Store: ${DOMAIN}`);
  hr();
  console.log('');

  const collections = await fetchAllCollections();
  console.log(`  Found ${collections.length} collections total.\n`);

  let done = 0, skippedAlready = 0, skippedNoConfig = 0, failed = 0;

  for (const col of collections) {
    const cfg = CONFIG[col.handle];

    if (!cfg) {
      process.stdout.write(`  ⬜  ${col.handle.padEnd(42)} no config — skipped\n`);
      skippedNoConfig++;
      continue;
    }

    if (col.alreadySet) {
      process.stdout.write(`  ⏭   ${col.handle.padEnd(42)} already configured — skipped\n`);
      skippedAlready++;
      continue;
    }

    const metafields = buildMetafields(col.id, cfg);
    if (!metafields.length) {
      skippedNoConfig++;
      continue;
    }

    try {
      const data = await gql(METAFIELDS_SET, { metafields });
      const result = data.metafieldsSet;
      if (result.userErrors?.length) {
        const msg = result.userErrors.map(e => e.message).join(', ');
        console.log(`  ❌  ${col.handle.padEnd(42)} ${msg}`);
        failed++;
      } else {
        const labels = [cfg.l1, cfg.l2, cfg.l3, cfg.l4].filter(Boolean).join(' › ');
        console.log(`  ✅  ${col.handle.padEnd(42)} ${labels}`);
        done++;
      }
    } catch (e) {
      console.log(`  ❌  ${col.handle.padEnd(42)} ${e.message}`);
      failed++;
    }

    await sleep(250);
  }

  console.log('');
  hr();
  console.log(`  ✅ Configured : ${done}`);
  console.log(`  ⏭  Already set: ${skippedAlready}`);
  console.log(`  ⬜ No config  : ${skippedNoConfig}`);
  console.log(`  ❌ Failed     : ${failed}`);
  hr();
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
