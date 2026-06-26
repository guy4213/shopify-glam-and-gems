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

const data = await gql(`{
  menus(first: 20) {
    edges {
      node {
        id
        title
        handle
        items {
          id
          title
          url
          type
          resourceId
          items {
            id
            title
            url
            type
            resourceId
            items {
              id
              title
              url
              type
              resourceId
            }
          }
        }
      }
    }
  }
}`);

for (const { node: menu } of data.menus.edges) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`MENU: "${menu.title}"  handle: ${menu.handle}  id: ${menu.id}`);
  console.log('═'.repeat(60));

  function printItems(items, depth = 0) {
    const pad = '  '.repeat(depth);
    for (const item of items) {
      console.log(`${pad}├─ [${item.type}] "${item.title}"`);
      console.log(`${pad}   url: ${item.url}`);
      if (item.resourceId) console.log(`${pad}   resourceId: ${item.resourceId}`);
      if (item.items?.length) printItems(item.items, depth + 1);
    }
  }
  printItems(menu.items);
}
