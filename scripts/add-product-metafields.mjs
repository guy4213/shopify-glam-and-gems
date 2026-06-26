import { createRequire } from 'module';
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const GQL    = `https://${DOMAIN}/admin/api/2024-10/graphql.json`;

const DEFS = [
  { name: 'Product Type',      key: 'product_type',      type: 'single_line_text_field', description: 'Product category/type label for display on cards and filters' },
  { name: 'Total Carat Range', key: 'total_carat_range', type: 'single_line_text_field', description: 'Human-readable carat range string e.g. 0.5–1.0 ct' },
];

const MUTATION = `
  mutation CreateDef($def: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $def) {
      createdDefinition { id name namespace key type { name } }
      userErrors { field message }
    }
  }
`;

async function gql(variables) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query: MUTATION, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data.metafieldDefinitionCreate;
}

async function main() {
  for (const d of DEFS) {
    process.stdout.write(`  custom.${d.key} ...`);
    try {
      const r = await gql({ def: { name: d.name, namespace: 'custom', key: d.key, type: d.type, ownerType: 'PRODUCT', description: d.description, pin: true } });
      if (r.createdDefinition) {
        console.log(` ✅  Created [${r.createdDefinition.type.name}] ID: ${r.createdDefinition.id.split('/').pop()}`);
      } else {
        console.log(` ❌  ${r.userErrors.map(e => e.message).join(', ')}`);
      }
    } catch(e) { console.log(` ❌  ${e.message}`); }
    await new Promise(r => setTimeout(r, 400));
  }
}
main();
