#!/usr/bin/env node
/**
 * One-time script: aligns visual filter label metafields on Ready To Ship + Jewelry
 * to match the DRIVE_COLLECTION-IDEAL design.
 * Run: node update-collection-metafields.js
 */

const SHOPIFY_SHOP  = "glam-and-gems-2.myshopify.com";
const SHOPIFY_TOKEN = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION   = "2025-01";

// Target label set per collection — drives snippets/collection-filter-board.liquid
const TARGETS = [
  {
    handle: "ready-to-ship",
    labels: {
      visual_filter_label_1: "Shop by Category",
      visual_filter_label_2: "",
      visual_filter_label_3: "Stone Type",
      visual_filter_label_4: "Shop by Size",
    },
  },
  {
    handle: "jewelry",
    labels: {
      visual_filter_label_1: "Shop by Category",
      visual_filter_label_2: "Shop by Style",
      visual_filter_label_3: "Diamond Shape",
      visual_filter_label_4: "Stone Type",
    },
  },
];

async function gql(query, variables) {
  const url = `https://${SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error("GraphQL errors:\n" + JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function getCollectionId(handle) {
  const data = await gql(
    `query CollectionByHandle($handle: String!) {
       collectionByHandle(handle: $handle) { id title }
     }`,
    { handle }
  );
  if (!data.collectionByHandle) throw new Error(`Collection not found: ${handle}`);
  return data.collectionByHandle;
}

async function setMetafields(ownerId, labels) {
  // Split into writes (non-blank) and deletes (blank)
  const writes = Object.entries(labels)
    .filter(([, v]) => v && v.trim() !== "")
    .map(([key, value]) => ({
      ownerId,
      namespace: "custom",
      key,
      type: "single_line_text_field",
      value,
    }));

  const deletes = Object.entries(labels)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([key]) => ({
      ownerId,
      namespace: "custom",
      key,
    }));

  const results = [];

  if (writes.length > 0) {
    const data = await gql(
      `mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
         metafieldsSet(metafields: $metafields) {
           metafields { key value namespace }
           userErrors { field message }
         }
       }`,
      { metafields: writes }
    );
    const errs = data.metafieldsSet.userErrors;
    if (errs.length > 0) throw new Error("metafieldsSet errors:\n" + JSON.stringify(errs, null, 2));
    for (const m of data.metafieldsSet.metafields) results.push({ key: m.key, value: m.value, action: "set" });
  }

  if (deletes.length > 0) {
    const data = await gql(
      `mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
         metafieldsDelete(metafields: $metafields) {
           deletedMetafields { key namespace ownerId }
           userErrors { field message }
         }
       }`,
      { metafields: deletes }
    );
    const errs = data.metafieldsDelete.userErrors;
    if (errs.length > 0) {
      const ignorable = errs.every((e) => /not.*found|does not exist/i.test(e.message || ""));
      if (!ignorable) throw new Error("metafieldsDelete errors:\n" + JSON.stringify(errs, null, 2));
    }
    for (const d of deletes) results.push({ key: d.key, value: "(deleted)", action: "delete" });
  }

  return results;
}

async function main() {
  for (const t of TARGETS) {
    console.log(`\n=== ${t.handle} ===`);
    const { id, title } = await getCollectionId(t.handle);
    console.log(`  found: ${title} (${id})`);
    const written = await setMetafields(id, t.labels);
    for (const m of written) {
      console.log(`  ✓ [${m.action}] custom.${m.key} = "${m.value}"`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
