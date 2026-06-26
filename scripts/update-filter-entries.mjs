/**
 * update-filter-entries.mjs
 *
 * Updates existing filter_visual_option metaobject entries to match the
 * spreadsheet values, creates the Metal group, and keeps collection
 * filter_visual_options in sync.
 */

const DOMAIN      = 'glam-and-gems-2.myshopify.com';
const TOKEN       = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION = '2025-04';
const GQL         = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
const MO_TYPE     = 'filter_visual_option';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hr() { console.log('─'.repeat(58)); }

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

// ── Fetch all existing entries ────────────────────────────────────────────────
async function fetchAllEntries() {
  const nodes = [];
  let cursor = null;
  do {
    const data = await gql(`
      query($first: Int!, $after: String) {
        metaobjects(type: "${MO_TYPE}", first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { id fields { key value } }
        }
      }
    `, { first: 250, after: cursor });
    const { nodes: batch, pageInfo } = data.metaobjects;
    nodes.push(...batch.map(n => ({
      id:     n.id,
      fields: Object.fromEntries(n.fields.map(f => [f.key, f.value])),
    })));
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
  return nodes;
}

// ── Mutate a single entry (only fields listed are changed) ───────────────────
async function updateEntry(id, fields) {
  const fieldArr = Object.entries(fields).map(([key, value]) => ({ key, value: String(value ?? '') }));
  const { metaobjectUpdate: { userErrors } } = await gql(`
    mutation U($id: ID!, $mo: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $mo) {
        metaobject { id }
        userErrors { field message code }
      }
    }
  `, { id, mo: { fields: fieldArr } });
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
}

// ── Create a new entry ────────────────────────────────────────────────────────
async function createEntry(fields) {
  const fieldArr = Object.entries(fields)
    .filter(([, v]) => v != null)
    .map(([key, value]) => ({ key, value: String(value) }));
  const { metaobjectCreate: { metaobject, userErrors } } = await gql(`
    mutation C($mo: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $mo) {
        metaobject { id }
        userErrors { field message code }
      }
    }
  `, { mo: { type: MO_TYPE, fields: fieldArr } });
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return metaobject.id;
}

// ── Get a collection's current filter_visual_options GID list ─────────────────
async function getFilterOptions(handle) {
  const { collectionByHandle: col } = await gql(`
    query($h: String!) {
      collectionByHandle(handle: $h) {
        id
        metafields(first: 30, namespace: "custom") {
          nodes { key value }
        }
      }
    }
  `, { h: handle });
  const mf = col.metafields.nodes.find(m => m.key === 'filter_visual_options');
  return { id: col.id, gids: mf ? JSON.parse(mf.value) : [] };
}

async function setFilterOptions(ownerId, gids) {
  const { metafieldsSet: { userErrors } } = await gql(`
    mutation S($mf: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $mf) {
        metafields { key }
        userErrors { field message }
      }
    }
  `, {
    mf: [{
      ownerId,
      namespace: 'custom',
      key:       'filter_visual_options',
      value:     JSON.stringify(gids),
      type:      'list.metaobject_reference',
    }],
  });
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(58));
console.log('  Update Filter Metaobject Entries');
console.log('═'.repeat(58) + '\n');

// ── Step 0: load all existing entries ────────────────────────────────────────
console.log('Loading existing entries…');
const allEntries = await fetchAllEntries();
console.log(`  ${allEntries.length} entries found\n`);

// Build nested lookup: byGroup[filter_label][value_label] = entry
const byGroup = {};
for (const e of allEntries) {
  const fl = e.fields.filter_label || '';
  const vl = e.fields.value_label  || '';
  if (!byGroup[fl]) byGroup[fl] = {};
  byGroup[fl][vl] = e;
}

const newStyleGids = [];  // Hidden Halo, Double Halo, Bridal Set → added to Jewelry
const newMetalGids = [];  // White/Yellow/Rose Gold, Platinum → added to RTS + WR

// ── Step 1: Shop by Category — Necklaces → Necklaces & Pendants ──────────────
console.log('STEP 1 — Shop by Category');
hr();
const necklace = byGroup['Shop by Category']?.['Necklaces'];
if (necklace) {
  await updateEntry(necklace.id, {
    value_label:   'Necklaces & Pendants',
    display_label: 'Necklaces & Pendants',
  });
  console.log('  ✅  "Necklaces" → "Necklaces & Pendants"');
} else {
  console.log('  ⚠   "Necklaces" not found — already renamed?');
}
await sleep(250);

// ── Step 2: Stone Type ────────────────────────────────────────────────────────
console.log('\nSTEP 2 — Stone Type');
hr();

// Update "Lab Diamond" → "Lab-Grown Diamond"
const labDiamond = byGroup['Stone Type']?.['Lab Diamond'];
if (labDiamond) {
  await updateEntry(labDiamond.id, {
    value_label:   'Lab-Grown Diamond',
    display_label: 'Lab-Grown Diamond',
  });
  console.log('  ✅  "Lab Diamond" → "Lab-Grown Diamond"');
  await sleep(250);
}

// Retire Diamond, Sapphire, Ruby, Gemstone (change filter_label so they don't match anything)
for (const name of ['Diamond', 'Sapphire', 'Ruby', 'Gemstone']) {
  const entry = byGroup['Stone Type']?.[name];
  if (entry) {
    await updateEntry(entry.id, { filter_label: '_retired' });
    console.log(`  🗑   Retired "Stone Type / ${name}"`);
    await sleep(250);
  }
}

// Moissanite: no change needed
console.log('  —   "Moissanite" kept as-is');

// ── Step 3: Metal — create 4 new entries ─────────────────────────────────────
console.log('\nSTEP 3 — Metal (new entries)');
hr();
const metalItems = [
  { value_label: 'White Gold',  color: '#E5E4E2', sort_order: 1 },
  { value_label: 'Yellow Gold', color: '#D4AF37', sort_order: 2 },
  { value_label: 'Rose Gold',   color: '#B76E79', sort_order: 3 },
  { value_label: 'Platinum',    color: '#E5E4E2', sort_order: 4 },
];
for (const item of metalItems) {
  const gid = await createEntry({
    filter_label:  'Metal',
    value_label:   item.value_label,
    display_label: item.value_label,
    color:         item.color,
    sort_order:    String(item.sort_order),
  });
  newMetalGids.push(gid);
  console.log(`  ✅  Created "${item.value_label}"  color: ${item.color}`);
  await sleep(250);
}

// ── Step 4: Shop by Style (Engagement) ───────────────────────────────────────
console.log('\nSTEP 4 — Shop by Style (Engagement)');
hr();
const styleGroup = byGroup['Shop by Style'] ?? {};

// 4a: Update sort_order on kept entries
const sortUpdates = {
  'Three Stone': '1',
  'Solitaire':   '2',
  'Halo':        '5',
};
for (const [name, order] of Object.entries(sortUpdates)) {
  const entry = styleGroup[name];
  if (entry) {
    await updateEntry(entry.id, { sort_order: order });
    console.log(`  ✅  Updated sort_order "${name}" → ${order}`);
    await sleep(250);
  }
}

// 4b: Rename "Side Stones" → "Side Stone", sort_order 3
const sideStones = styleGroup['Side Stones'];
if (sideStones) {
  await updateEntry(sideStones.id, {
    value_label:   'Side Stone',
    display_label: 'Side Stone',
    sort_order:    '3',
  });
  console.log('  ✅  "Side Stones" → "Side Stone" (sort 3)');
  await sleep(250);
}

// 4c: Retire Pave, Classic, Bezel, Vintage
for (const name of ['Pave', 'Classic', 'Bezel', 'Vintage']) {
  const entry = styleGroup[name];
  if (entry) {
    await updateEntry(entry.id, { filter_label: '_retired' });
    console.log(`  🗑   Retired "Shop by Style / ${name}"`);
    await sleep(250);
  }
}

// 4d: Create Hidden Halo, Double Halo, Bridal Set
for (const item of [
  { value_label: 'Hidden Halo', sort_order: '4' },
  { value_label: 'Double Halo', sort_order: '6' },
  { value_label: 'Bridal Set',  sort_order: '7' },
]) {
  const gid = await createEntry({
    filter_label:  'Shop by Style',
    value_label:   item.value_label,
    display_label: item.value_label,
    sort_order:    item.sort_order,
  });
  newStyleGids.push(gid);
  console.log(`  ✅  Created "${item.value_label}" (sort ${item.sort_order})`);
  await sleep(250);
}

// ── Step 5: Patch filter_visual_options on affected collections ───────────────
console.log('\nSTEP 5 — Patch collection filter_visual_options');
hr();

// Ready To Ship — append Metal entries
{
  const { id, gids } = await getFilterOptions('ready-to-ship');
  const updated = [...gids, ...newMetalGids];
  await setFilterOptions(id, updated);
  console.log(`  ✅  ready-to-ship: +${newMetalGids.length} Metal entries (total ${updated.length})`);
  await sleep(350);
}

// Wedding Rings — append Metal entries
{
  const { id, gids } = await getFilterOptions('wedding-rings');
  const updated = [...gids, ...newMetalGids];
  await setFilterOptions(id, updated);
  console.log(`  ✅  wedding-rings: +${newMetalGids.length} Metal entries (total ${updated.length})`);
  await sleep(350);
}

// Jewelry — append new Style entries (Hidden Halo, Double Halo, Bridal Set)
{
  const { id, gids } = await getFilterOptions('jewelry');
  const updated = [...gids, ...newStyleGids];
  await setFilterOptions(id, updated);
  console.log(`  ✅  jewelry: +${newStyleGids.length} Style entries (total ${updated.length})`);
  await sleep(350);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(58));
console.log('  ✅  Done!');
console.log(`  • Category:   1 label renamed`);
console.log(`  • Stone Type: 1 renamed, 4 retired`);
console.log(`  • Metal:      4 new entries created with hex colors`);
console.log(`  • Style:      3 sort-order updates, 1 rename, 4 retired, 3 new`);
console.log(`  • Collections: filter_visual_options patched on 3 collections`);
console.log('═'.repeat(58) + '\n');
