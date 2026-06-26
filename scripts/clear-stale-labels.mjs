/**
 * clear-stale-labels.mjs
 *
 * Deletes stale visual_filter_label metafields left by the old bulk-set script:
 *   - Wedding Rings:  visual_filter_label_3 (dup "Diamond Shape") + visual_filter_label_4 ("Price")
 *   - Ready To Ship:  visual_filter_label_4 ("Price")
 */

const DOMAIN      = 'glam-and-gems-2.myshopify.com';
const TOKEN       = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION = '2025-04';
const GQL         = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

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

async function getCollectionId(handle) {
  const { collectionByHandle } = await gql(
    `query($h: String!) { collectionByHandle(handle: $h) { id title } }`,
    { h: handle }
  );
  if (!collectionByHandle) throw new Error(`Collection not found: ${handle}`);
  return collectionByHandle;
}

async function getMetafieldId(ownerId, key) {
  const { collection } = await gql(`
    query($id: ID!) {
      collection(id: $id) {
        metafields(first: 50, namespace: "custom") {
          nodes { id key value }
        }
      }
    }
  `, { id: ownerId });

  const mf = collection.metafields.nodes.find(m => m.key === key);
  return mf ?? null;
}

async function deleteMetafield(ownerId, namespace, key) {
  const { metafieldsDelete: { userErrors } } = await gql(`
    mutation Del($mf: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $mf) {
        userErrors { field message }
      }
    }
  `, { mf: [{ ownerId, namespace, key }] });
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
}

const TARGETS = [
  { handle: 'wedding-rings',  keys: ['visual_filter_label_3', 'visual_filter_label_4'] },
  { handle: 'ready-to-ship',  keys: ['visual_filter_label_4'] },
];

console.log('\n' + '═'.repeat(60));
console.log('  Clear Stale Filter Labels');
console.log('═'.repeat(60) + '\n');

for (const { handle, keys } of TARGETS) {
  const col = await getCollectionId(handle);
  console.log(`\n  "${col.title}" [${col.id}]`);

  for (const key of keys) {
    const mf = await getMetafieldId(col.id, key);
    if (!mf) {
      console.log(`    ⚠  ${key.padEnd(28)} not found / already deleted`);
      continue;
    }
    console.log(`    Found  ${key.padEnd(22)} = "${mf.value}"  → deleting…`);
    await deleteMetafield(col.id, 'custom', key);
    console.log(`    ✓  ${key} deleted`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('  ✅  Done — stale labels removed');
console.log('═'.repeat(60) + '\n');
