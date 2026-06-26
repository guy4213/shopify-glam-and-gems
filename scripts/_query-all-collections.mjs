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

const QUERY = `
  query($cursor: String) {
    collections(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          productsCount { count }
          sortOrder
          updatedAt
        }
      }
    }
  }
`;

let all = [], cursor = null;
do {
  const data = await gql(QUERY, { cursor });
  for (const { node } of data.collections.edges) all.push(node);
  cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
} while (cursor);

all.sort((a, b) => a.title.localeCompare(b.title));

console.log(`\nTotal collections: ${all.length}\n`);
console.log('Handle'.padEnd(45) + 'Title'.padEnd(40) + 'Products');
console.log('─'.repeat(95));
for (const c of all) {
  console.log(c.handle.padEnd(45) + c.title.padEnd(40) + c.productsCount.count);
}

// Search specifically for the missing ones
const search = ['jewelry','jewel','ready','education','moissanite','lab','diamond'];
console.log('\n\n=== Searching for: jewelry / ready / education / moissanite ===\n');
for (const c of all) {
  const t = (c.title + c.handle).toLowerCase();
  if (search.some(s => t.includes(s))) {
    console.log(`  ✓  ${c.handle.padEnd(45)} "${c.title}"  (${c.productsCount.count} products)`);
  }
}
