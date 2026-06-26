const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const GQL    = `https://${DOMAIN}/admin/api/2024-10/graphql.json`;
const ID     = 'gid://shopify/MetafieldDefinition/199583563966';

const res = await fetch(GQL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
  body: JSON.stringify({
    query: `mutation DeleteDef($id: ID!) {
      metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: true) {
        deletedDefinitionId
        userErrors { field message }
      }
    }`,
    variables: { id: ID },
  }),
});

const json = await res.json();
const r = json.data.metafieldDefinitionDelete;

if (r.deletedDefinitionId) {
  console.log(`✅ Deleted: custom.promo_banner_html (${r.deletedDefinitionId})`);
} else {
  console.log(`❌ Failed: ${r.userErrors.map(e => e.message).join(', ')}`);
}
