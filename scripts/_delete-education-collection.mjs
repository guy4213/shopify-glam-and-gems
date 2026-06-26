const DOMAIN = "glam-and-gems-2.myshopify.com";
const TOKEN  = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const GQL    = `https://${DOMAIN}/admin/api/2025-04/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data;
}

const data = await gql(`{ collectionByHandle(handle: "education") { id title } }`);
const col = data.collectionByHandle;
if (!col) { console.log('Collection not found — already deleted?'); process.exit(0); }

console.log(`Deleting collection: "${col.title}" (${col.id})`);

const del = await gql(`
  mutation { collectionDelete(input: { id: "${col.id}" }) {
    deletedCollectionId
    userErrors { message }
  }}
`);

if (del.collectionDelete.userErrors?.length) {
  console.log('❌', del.collectionDelete.userErrors.map(e => e.message).join(', '));
} else {
  console.log('✅ Deleted successfully.');
}
