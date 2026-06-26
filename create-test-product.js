#!/usr/bin/env node
/**
 * create-test-product.js
 * One-time script: creates a DRAFT test diamond product in Shopify for Worker testing.
 * Requires Node.js >= 18 (uses built-in fetch).
 * Run: node create-test-product.js
 */

const SHOPIFY_SHOP  = "glam-and-gems-2.myshopify.com";
const SHOPIFY_TOKEN = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION   = "2025-01";

// ─── Product definition ───────────────────────────────────────────────────────

const METAFIELDS = [
  // ── Carat automation fields ──────────────────────────────────────────────
  { key: "isDiamond",           value: "yes",              type: "single_line_text_field" },
  { key: "total_carat_range",   value: "5 Carat",          type: "single_line_text_field" },
  { key: "stone_weight_m_2",    value: "3 Carat",          type: "single_line_text_field" },
  { key: "stone_weight_m_1",    value: "4 Carat",          type: "single_line_text_field" },
  { key: "stone_weight_p_1",    value: "6 Carat",          type: "single_line_text_field" },
  { key: "stone_weight_p_2",    value: "7 Carat",          type: "single_line_text_field" },
  { key: "center_stone_weight", value: "5.0",              type: "number_decimal" },
  { key: "original_price",      value: "3775.0",           type: "number_decimal" },
  { key: "minus_2_size_ct",     value: "1110.0",           type: "number_decimal" },
  { key: "minus_1_size_ct",     value: "1230.0",           type: "number_decimal" },
  { key: "plus_1_size_ct",      value: "1470.0",           type: "number_decimal" },
  { key: "plus_2_size_ct",      value: "1590.0",           type: "number_decimal" },
  // ── General product fields ───────────────────────────────────────────────
  { key: "product_type",        value: "Engagement Ring",  type: "single_line_text_field" },
  { key: "total_carat",         value: "6.3",              type: "number_decimal" },
  { key: "diamond_shape",       value: "Radiant",          type: "single_line_text_field" },
  { key: "stone_type",          value: "Lab-grown Diamond",type: "single_line_text_field" },
  { key: "style_1",             value: "Three Stone,Bezel",type: "single_line_text_field" },
  { key: "style_2",             value: "Bezel",            type: "single_line_text_field" },
  { key: "metal_type",          value: "White Gold",       type: "single_line_text_field" },
  { key: "ready_to_ship",       value: "false",            type: "boolean" },
].map(({ key, value, type }) => ({ namespace: "custom", key, value, type }));

// Options with their values — variantStrategy: CREATE builds all 24 combinations automatically
const OPTIONS = [
  {
    name: "Metal Type",
    values: [
      { name: "Yellow Gold" },
      { name: "White Gold"  },
      { name: "Rose Gold"   },
    ],
  },
  {
    name: "Ring Size",
    values: ["4", "5", "6", "7", "8", "9", "10", "11"].map((s) => ({ name: s })),
  },
];

// ─── GraphQL helper ───────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Step 1 — Create product (title + status + metafields only; options/variants removed in 2025-01)
  console.log("Step 1: Creating product...");
  const createData = await gql(
    `mutation CreateProduct($input: ProductInput!) {
       productCreate(input: $input) {
         product { id title }
         userErrors { field message }
       }
     }`,
    {
      input: {
        title: "TEST 777 - Carat Worker",
        status: "DRAFT",
        metafields: METAFIELDS,
      },
    }
  );

  const { product, userErrors: createErrors } = createData.productCreate;
  if (createErrors.length > 0) {
    console.error("productCreate userErrors:\n", JSON.stringify(createErrors, null, 2));
    process.exit(1);
  }
  console.log(`  Created: ${product.id}`);

  // Step 2 — Add Metal Type + Ring Size options (variantStrategy: CREATE builds all 24 variants)
  console.log("Step 2: Adding options and creating variants...");
  const optionsData = await gql(
    `mutation AddOptions($productId: ID!, $options: [OptionCreateInput!]!) {
       productOptionsCreate(productId: $productId, options: $options, variantStrategy: CREATE) {
         userErrors { field message code }
         product {
           variants(first: 50) {
             edges { node { id } }
           }
         }
       }
     }`,
    { productId: product.id, options: OPTIONS }
  );

  const { userErrors: optionErrors, product: updatedProduct } = optionsData.productOptionsCreate;
  if (optionErrors.length > 0) {
    console.error("productOptionsCreate userErrors:\n", JSON.stringify(optionErrors, null, 2));
    process.exit(1);
  }

  const variantCount = updatedProduct.variants.edges.length;
  console.log(`  Options added — ${variantCount} variants created`);

  // ─── Output ───────────────────────────────────────────────────────────────

  const numericId = product.id.replace("gid://shopify/Product/", "");
  const adminUrl  = `https://${SHOPIFY_SHOP}/admin/products/${numericId}`;

  console.log("\nSUCCESS — product ready for Worker test\n");
  console.log(`  Title:        ${product.title}`);
  console.log(`  GID (full):   ${product.id}`);
  console.log(`  ID (numeric): ${numericId}`);
  console.log(`  Admin URL:    ${adminUrl}`);
  console.log(`\n─── curl test command ───────────────────────────────────────────\n`);
  console.log(`curl -X POST https://YOUR_WORKER_URL \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "X-Worker-Secret: YOUR_SECRET" \\`);
  console.log(`  -d '{"product_id":"${product.id}"}'`);
  console.log(`\n─────────────────────────────────────────────────────────────────`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
