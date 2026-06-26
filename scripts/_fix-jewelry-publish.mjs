const DOMAIN = "glam-and-gems-2.myshopify.com";
const TOKEN  = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const BASE   = `https://${DOMAIN}/admin/api/2025-04`;

async function rest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

// Publish a collection via REST (sets published: true)
async function publishCollection(handle) {
  // First get the collection by handle
  const { ok, json } = await rest('GET', `/custom_collections.json?handle=${handle}&fields=id,title,handle,published_at`);

  let col = json.custom_collections?.[0];

  // Try smart collections if not found in custom
  if (!col) {
    const r2 = await rest('GET', `/smart_collections.json?handle=${handle}&fields=id,title,handle,published_at`);
    col = r2.json.smart_collections?.[0];
  }

  if (!col) {
    console.log(`⚠️   "${handle}" — not found`);
    return;
  }

  console.log(`Found: "${col.title}" (ID: ${col.id}) — published_at: ${col.published_at ?? 'null'}`);

  if (col.published_at) {
    console.log(`✅  Already published — /collections/${col.handle} should be live.\n`);
    return;
  }

  // Publish it
  const endpoint = json.custom_collections?.[0]
    ? `/custom_collections/${col.id}.json`
    : `/smart_collections/${col.id}.json`;

  const update = await rest('PUT', endpoint, {
    [json.custom_collections?.[0] ? 'custom_collection' : 'smart_collection']: {
      id: col.id,
      published: true,
    }
  });

  if (update.ok) {
    console.log(`✅  Published! /collections/${col.handle} is now live.\n`);
  } else {
    console.log(`❌  Error ${update.status}:`, JSON.stringify(update.json), '\n');
  }
}

console.log('=== Jewelry ===');
await publishCollection('jewelry');

console.log('=== Moissanite ===');
await publishCollection('moissanite');
