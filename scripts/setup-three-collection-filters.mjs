/**
 * setup-three-collection-filters.mjs
 *
 * Targeted setup for Jewelry, Ready To Ship, and Wedding Rings collections.
 *
 * What this script does:
 *   1. Force-overwrites visual_filter_label_1–4 on each collection with the
 *      design-spec values (replacing the old generic Style/Metal/Diamond/Price labels).
 *   2. Creates filter_visual_option metaobject entries for every filter group
 *      defined below (image + color fields left blank; add them via Admin UI later).
 *   3. Sets custom.filter_visual_options on each collection to the ordered list
 *      of GIDs relevant to that collection.
 *
 * Prerequisites (already confirmed in store):
 *   ✓ Metaobject definition: filter_visual_option
 *   ✓ Metafield definition:  custom.filter_visual_options (list.metaobject_reference)
 */

const DOMAIN      = 'glam-and-gems-2.myshopify.com';
const TOKEN       = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION = '2025-04';
const GQL         = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
const MO_TYPE     = 'filter_visual_option';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hr(n = 60) { console.log('─'.repeat(n)); }

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body:    JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(' | '));
  return json.data;
}

// ─── Collection GID lookup ────────────────────────────────────────────────────

async function getCollectionId(handle) {
  const { collectionByHandle } = await gql(`
    query($h: String!) { collectionByHandle(handle: $h) { id title } }
  `, { h: handle });
  if (!collectionByHandle) throw new Error(`Collection not found: ${handle}`);
  return collectionByHandle;
}

// ─── Metaobject entry creation ────────────────────────────────────────────────

async function createEntry({ filter_label, value_label, display_label, color, sort_order }) {
  const fields = [
    { key: 'filter_label',  value: filter_label  },
    { key: 'value_label',   value: value_label   },
    ...(display_label ? [{ key: 'display_label', value: display_label }] : []),
    ...(color         ? [{ key: 'color',         value: color         }] : []),
    ...(sort_order != null ? [{ key: 'sort_order', value: String(sort_order) }] : []),
  ];

  const { metaobjectCreate: { metaobject, userErrors } } = await gql(`
    mutation Create($mo: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $mo) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }
  `, { mo: { type: MO_TYPE, fields } });

  if (userErrors.length) {
    const msg = userErrors.map(e => `${e.field}: ${e.message}`).join(', ');
    console.warn(`    ⚠  ${value_label} → ${msg}`);
    return null;
  }
  return metaobject;
}

// ─── Metafields set ───────────────────────────────────────────────────────────

async function setMetafields(ownerId, fields) {
  const metafields = fields.map(f => ({ ownerId, namespace: 'custom', ...f }));

  const { metafieldsSet: { metafields: saved, userErrors } } = await gql(`
    mutation Set($mf: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $mf) {
        metafields { key value type }
        userErrors { field message code }
      }
    }
  `, { mf: metafields });

  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return saved;
}

// ─── Filter group definitions ─────────────────────────────────────────────────
//
// value_label   → must match the Shopify storefront filter value label EXACTLY
//                 (set under Admin → Navigation → Filters when products are added).
//                 Update these values to match once products and filters are live.
// display_label → what the shopper sees in the tile (falls back to value_label if blank).
// color         → hex string, only for metal/swatch-style chips.
// sort_order    → display order within the group (lower = first).
//
// NOTE: image field is left blank here. To add images, open each entry in
//   Shopify Admin → Content → Metaobjects → Filter Visual Option
//   and upload an image to the "Image" field.
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = {

  CATEGORY: {
    filterLabel: 'Shop by Category',
    items: [
      { value_label: 'Engagement Rings',   display_label: 'Engagement Rings',   sort_order: 1 },
      { value_label: 'Wedding Rings',      display_label: 'Wedding Rings',       sort_order: 2 },
      { value_label: 'Earrings',           display_label: 'Earrings',            sort_order: 3 },
      { value_label: 'Necklaces',          display_label: 'Necklaces',           sort_order: 4 },
      { value_label: 'Bracelets',          display_label: 'Bracelets',           sort_order: 5 },
      { value_label: 'Fashion Rings',      display_label: 'Fashion Rings',       sort_order: 6 },
    ],
  },

  SHOP_BY_STYLE: {
    filterLabel: 'Shop by Style',
    items: [
      { value_label: 'Solitaire',    display_label: 'Solitaire',    sort_order: 1 },
      { value_label: 'Halo',         display_label: 'Halo',         sort_order: 2 },
      { value_label: 'Pave',         display_label: 'Pavé',         sort_order: 3 },
      { value_label: 'Three Stone',  display_label: 'Three Stone',  sort_order: 4 },
      { value_label: 'Classic',      display_label: 'Classic',      sort_order: 5 },
      { value_label: 'Bezel',        display_label: 'Bezel',        sort_order: 6 },
      { value_label: 'Vintage',      display_label: 'Vintage',      sort_order: 7 },
      { value_label: 'Side Stones',  display_label: 'Side Stones',  sort_order: 8 },
    ],
  },

  DIAMOND_SHAPE: {
    filterLabel: 'Diamond Shape',
    items: [
      { value_label: 'Round',     display_label: 'Round',     sort_order: 1 },
      { value_label: 'Oval',      display_label: 'Oval',      sort_order: 2 },
      { value_label: 'Princess',  display_label: 'Princess',  sort_order: 3 },
      { value_label: 'Cushion',   display_label: 'Cushion',   sort_order: 4 },
      { value_label: 'Pear',      display_label: 'Pear',      sort_order: 5 },
      { value_label: 'Marquise',  display_label: 'Marquise',  sort_order: 6 },
      { value_label: 'Emerald',   display_label: 'Emerald',   sort_order: 7 },
      { value_label: 'Radiant',   display_label: 'Radiant',   sort_order: 8 },
      { value_label: 'Heart',     display_label: 'Heart',     sort_order: 9 },
      { value_label: 'Asscher',   display_label: 'Asscher',   sort_order: 10 },
    ],
  },

  STONE_TYPE: {
    filterLabel: 'Stone Type',
    items: [
      { value_label: 'Diamond',     display_label: 'Diamond',     sort_order: 1 },
      { value_label: 'Moissanite',  display_label: 'Moissanite',  sort_order: 2 },
      { value_label: 'Lab Diamond', display_label: 'Lab Diamond', sort_order: 3 },
      { value_label: 'Sapphire',    display_label: 'Sapphire',    sort_order: 4 },
      { value_label: 'Ruby',        display_label: 'Ruby',        sort_order: 5 },
      { value_label: 'Gemstone',    display_label: 'Gemstone',    sort_order: 6 },
    ],
  },

  SHOP_BY_SIZE: {
    filterLabel: 'Shop by Size',
    items: [
      { value_label: '4',    sort_order: 1  },
      { value_label: '4.5',  sort_order: 2  },
      { value_label: '5',    sort_order: 3  },
      { value_label: '5.5',  sort_order: 4  },
      { value_label: '6',    sort_order: 5  },
      { value_label: '6.5',  sort_order: 6  },
      { value_label: '7',    sort_order: 7  },
      { value_label: '7.5',  sort_order: 8  },
      { value_label: '8',    sort_order: 9  },
      { value_label: '8.5',  sort_order: 10 },
      { value_label: '9',    sort_order: 11 },
    ],
  },

  WEDDING_STYLE: {
    filterLabel: 'Style',
    items: [
      { value_label: 'Classic',        display_label: 'Classic',        sort_order: 1 },
      { value_label: 'Side Diamonds',  display_label: 'Side Diamonds',  sort_order: 2 },
      { value_label: 'Bezel',          display_label: 'Bezel',          sort_order: 3 },
      { value_label: 'Eternity',       display_label: 'Eternity',       sort_order: 4 },
      { value_label: 'Half Eternity',  display_label: 'Half Eternity',  sort_order: 5 },
      { value_label: 'Contoured',      display_label: 'Contoured',      sort_order: 6 },
      { value_label: 'Curved',         display_label: 'Curved',         sort_order: 7 },
    ],
  },
};

// ─── Per-collection config ────────────────────────────────────────────────────

const COLLECTIONS = {
  'jewelry': {
    title:  'Jewelry',
    labels: {
      visual_filter_label_1: 'Shop by Category',
      visual_filter_label_2: 'Shop by Style',
      visual_filter_label_3: 'Diamond Shape',
      visual_filter_label_4: 'Stone Type',
    },
    groups: ['CATEGORY', 'SHOP_BY_STYLE', 'DIAMOND_SHAPE', 'STONE_TYPE'],
  },
  'ready-to-ship': {
    title:  'Ready To Ship',
    labels: {
      visual_filter_label_1: 'Shop by Category',
      visual_filter_label_2: 'Stone Type',
      visual_filter_label_3: 'Shop by Size',
      visual_filter_label_4: null,        // not used for this collection
    },
    groups: ['CATEGORY', 'STONE_TYPE', 'SHOP_BY_SIZE'],
  },
  'wedding-rings': {
    title:  'Wedding Rings',
    labels: {
      visual_filter_label_1: 'Style',
      visual_filter_label_2: 'Diamond Shape',
      visual_filter_label_3: null,
      visual_filter_label_4: null,
    },
    groups: ['WEDDING_STYLE', 'DIAMOND_SHAPE'],
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Three-Collection Filter Setup');
  console.log(`  Store : ${DOMAIN}`);
  console.log(`  API   : ${API_VERSION}`);
  console.log('═'.repeat(60) + '\n');

  // ── Step 1: Resolve collection GIDs ──────────────────────────────────────
  console.log('STEP 1 — Resolve collection IDs');
  hr();
  const colGids = {};
  for (const [handle, cfg] of Object.entries(COLLECTIONS)) {
    const col = await getCollectionId(handle);
    colGids[handle] = col.id;
    console.log(`  ✓  ${cfg.title.padEnd(18)} ${col.id}`);
  }
  console.log();

  // ── Step 2: Create all metaobject entries ─────────────────────────────────
  console.log('STEP 2 — Create filter_visual_option metaobject entries');
  hr();
  const groupGids = {};   // GROUPS key → array of created GIDs (in order)

  for (const [groupKey, group] of Object.entries(GROUPS)) {
    groupGids[groupKey] = [];
    console.log(`\n  Group: "${group.filterLabel}" (${group.items.length} items)`);

    for (const item of group.items) {
      const entry = await createEntry({
        filter_label:  group.filterLabel,
        value_label:   item.value_label,
        display_label: item.display_label || null,
        color:         item.color         || null,
        sort_order:    item.sort_order     ?? null,
      });

      if (entry) {
        groupGids[groupKey].push(entry.id);
        const label = item.display_label || item.value_label;
        console.log(`    ✓  ${label.padEnd(18)} ${entry.id}`);
      }
      await sleep(200);   // stay well within API rate limits
    }
  }
  console.log();

  // ── Step 3: Set metafields on each collection ─────────────────────────────
  console.log('STEP 3 — Assign metafields to collections');
  hr();

  for (const [handle, cfg] of Object.entries(COLLECTIONS)) {
    const ownerId = colGids[handle];
    console.log(`\n  "${cfg.title}" [${ownerId}]`);

    // Build the GID list for this collection (preserves per-group order)
    const moIds = cfg.groups.flatMap(g => groupGids[g] ?? []);

    // Label metafields (only non-null values)
    const labelFields = Object.entries(cfg.labels)
      .filter(([, v]) => v)
      .map(([key, value]) => ({ key, value, type: 'single_line_text_field' }));

    // filter_visual_options
    const optionsField = moIds.length > 0 ? [{
      key:   'filter_visual_options',
      value: JSON.stringify(moIds),
      type:  'list.metaobject_reference',
    }] : [];

    const saved = await setMetafields(ownerId, [...labelFields, ...optionsField]);

    for (const mf of saved) {
      if (mf.key === 'filter_visual_options') {
        console.log(`    ✓  filter_visual_options  → [${moIds.length} entries]`);
      } else {
        console.log(`    ✓  ${mf.key.padEnd(26)} → "${mf.value}"`);
      }
    }
    await sleep(300);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalEntries = Object.values(groupGids).reduce((s, a) => s + a.length, 0);
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅  Done!');
  console.log(`  • ${totalEntries} metaobject entries created`);
  console.log(`  • ${Object.keys(COLLECTIONS).length} collections updated`);
  console.log('═'.repeat(60));
  console.log('\nNext steps:');
  console.log('  1. Shopify Admin → Content → Metaobjects → "Filter Visual Option"');
  console.log('     Open each entry and upload an image (Diamond Shape, Category, Style tiles)');
  console.log('  2. Admin → Navigation → Filters: verify that the value_label strings');
  console.log('     in this script exactly match your storefront filter values');
  console.log('     (they become functional once products are added and filters are configured)');
  console.log('  3. Preview a collection page — the custom filter board should now render\n');
}

main().catch(e => {
  console.error('\n❌  Fatal:', e.message);
  process.exit(1);
});
