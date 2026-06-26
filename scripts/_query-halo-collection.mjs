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
  if (json.errors) throw new Error(json.errors.map(e=>e.message).join(', '));
  return json.data;
}

// Search all collections for "halo"
const data = await gql(`{
  collections(first: 50, query: "halo") {
    edges {
      node {
        id
        title
        handle
        metafields(first: 20, namespace: "custom") {
          edges {
            node { key value type }
          }
        }
      }
    }
  }
}`);

console.log('\n=== Collections matching "halo" ===\n');
for (const { node: c } of data.collections.edges) {
  console.log(`Title  : ${c.title}`);
  console.log(`Handle : ${c.handle}`);
  console.log(`ID     : ${c.id}`);
  const mfs = c.metafields.edges.map(e => e.node);
  if (mfs.length) {
    console.log('Custom metafields:');
    for (const m of mfs) console.log(`  ${m.key.padEnd(28)} = ${m.value}`);
  } else {
    console.log('Custom metafields: (none set)');
  }
  console.log('');
}

// Also list all collections so we see what "main" collections exist
const all = await gql(`{
  collections(first: 100) {
    edges { node { id title handle } }
  }
}`);
console.log('=== All collections ===');
for (const { node: c } of all.collections.edges) {
  console.log(`  ${c.handle.padEnd(40)} ${c.title}`);
}
