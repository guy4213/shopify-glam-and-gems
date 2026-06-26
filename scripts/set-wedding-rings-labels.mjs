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

// Resolve collection GID
const { collectionByHandle } = await gql(
  `query($h: String!) { collectionByHandle(handle: $h) { id title } }`,
  { h: 'wedding-rings' }
);
if (!collectionByHandle) throw new Error('Collection "wedding-rings" not found');
const { id: ownerId, title } = collectionByHandle;
console.log(`\n  Collection : ${title}`);
console.log(`  GID        : ${ownerId}\n`);

// Set the two metafields
const { metafieldsSet: { metafields, userErrors } } = await gql(`
  mutation Set($mf: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $mf) {
      metafields { key value }
      userErrors  { field message }
    }
  }
`, {
  mf: [
    { ownerId, namespace: 'custom', key: 'visual_filter_label_3', value: 'Metal', type: 'single_line_text_field' },
    { ownerId, namespace: 'custom', key: 'visual_filter_label_4', value: 'Price', type: 'single_line_text_field' },
  ],
});

if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));

for (const mf of metafields) {
  console.log(`  ✅  custom.${mf.key.padEnd(26)} = "${mf.value}"`);
}
console.log('\nDone.\n');
