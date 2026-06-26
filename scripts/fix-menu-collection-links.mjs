const DOMAIN   = "glam-and-gems-2.myshopify.com";
const TOKEN    = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const GQL      = `https://${DOMAIN}/admin/api/2025-04/graphql.json`;
const MENU_ID  = "gid://shopify/Menu/245604024510";

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

// ── Fetch the current menu with all item IDs ──────────────────────────────────
const MENU_QUERY = `
  query GetMenu($id: ID!) {
    menu(id: $id) {
      id title handle
      items {
        id title type url resourceId
        items {
          id title type url resourceId
          items {
            id title type url resourceId
          }
        }
      }
    }
  }
`;

// ── URL fixes: old url → new url ──────────────────────────────────────────────
// Only fix URLs for collections that NOW exist in the store.
const URL_FIXES = {
  // Jewelry top-level was pointing to homepage
  '/collections/jewelry-collection': '/collections/jewelry',
};

// Items that are FRONTPAGE (url: /) which should link to a real collection
// key = item title (exact match at top level only)
const TOP_LEVEL_FIXES = {
  'Jewelry': { type: 'HTTP', url: '/collections/jewelry' },
};

// ── Recursively build the items input, applying fixes ────────────────────────
function buildItems(items, depth = 0) {
  return items.map(item => {
    const out = {
      id:    item.id,
      title: item.title,
      type:  item.type,
      url:   item.url,
    };

    // Top-level: fix items that point to wrong place
    if (depth === 0 && TOP_LEVEL_FIXES[item.title]) {
      const fix = TOP_LEVEL_FIXES[item.title];
      out.type = fix.type;
      out.url  = fix.url;
      console.log(`  ✏️   "${item.title}" : ${item.url || item.type} → ${fix.url}`);
    }

    // Any depth: fix specific broken URLs
    if (URL_FIXES[item.url]) {
      console.log(`  ✏️   "${item.title}" url: ${item.url} → ${URL_FIXES[item.url]}`);
      out.url = URL_FIXES[item.url];
    }

    // Recurse children
    if (item.items?.length) {
      out.items = buildItems(item.items, depth + 1);
    }

    return out;
  });
}

const MENU_UPDATE = `
  mutation MenuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, items: $items) {
      menu { id title handle items { title type url } }
      userErrors { field message code }
    }
  }
`;

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Fix main-menu collection links');
console.log(`  Store: ${DOMAIN}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const data = await gql(MENU_QUERY, { id: MENU_ID });
const menu = data.menu;
console.log(`  Menu: "${menu.title}"  (${menu.items.length} top-level items)\n`);
console.log('  Changes:\n');

const updatedItems = buildItems(menu.items);

const result = await gql(MENU_UPDATE, { id: MENU_ID, title: menu.title, items: updatedItems });
const upd = result.menuUpdate;

if (upd.userErrors?.length) {
  console.log('\n  ❌  Errors:');
  for (const e of upd.userErrors) console.log(`      ${e.field}: ${e.message} (${e.code})`);
  process.exit(1);
}

console.log('\n  ✅  Menu updated successfully.');
console.log('\n  Top-level items now:');
for (const item of upd.menu.items) {
  console.log(`    [${item.type}] "${item.title}"  →  ${item.url || '(dropdown)'}`);
}
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
