/**
 * Glam & Gems — Carat Size Automation Worker
 * Triggered by Shopify Flow on product create/update when isDiamond = "yes"
 * Adds "Carat Size" option and sets per-carat prices across all variants.
 *
 * Required env vars (set in Cloudflare dashboard):
 *   SHOPIFY_TOKEN   — shpat_... Admin API token
 *   SHOPIFY_SHOP    — glam-and-gems-2.myshopify.com
 *   WORKER_SECRET   — random string shared with Flow
 */

const API_VERSION = "2025-01";
const MAX_RETRIES = 3;
const BATCH_SIZE = 100;

// ─── Structured logger ────────────────────────────────────────────────────────

function log(level, step, message, extra = {}) {
  console[level](JSON.stringify({ level, step, message, ...extra }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Validate shared secret so only Flow can trigger this
    if (request.headers.get("X-Worker-Secret") !== env.WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { product_id } = body;
    if (!product_id) {
      return new Response("Missing product_id", { status: 400 });
    }

    try {
      const result = await processProduct(product_id, env);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      log("error", "fetch", err.message, { product_id });
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// ─── Shopify GraphQL helper with retry + throttle backoff ────────────────────

async function gql(query, variables, env, attempt = 0) {
  const url = `https://${env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  // HTTP 429 — hard rate limit
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES - 1) throw new Error("Rate limited after max retries");
    const delay = Math.pow(2, attempt) * 1000;
    log("warn", "gql", `HTTP 429 — retrying in ${delay}ms`, { attempt });
    await sleep(delay);
    return gql(query, variables, env, attempt + 1);
  }

  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json();

  // GraphQL-level THROTTLED error — use cost extensions for smart wait
  if (json.errors) {
    const throttled = json.errors.some((e) => e?.extensions?.code === "THROTTLED");
    if (throttled && attempt < MAX_RETRIES - 1) {
      const throttleStatus = json.extensions?.cost?.throttleStatus;
      const requestedCost = json.extensions?.cost?.requestedQueryCost ?? 0;
      let delay;
      if (throttleStatus) {
        const needed = Math.max(0, requestedCost - throttleStatus.currentlyAvailable);
        delay = Math.max(1000, Math.ceil((needed / throttleStatus.restoreRate) * 1000));
      } else {
        delay = Math.pow(2, attempt) * 1000;
      }
      log("warn", "gql", `THROTTLED — retrying in ${delay}ms`, { attempt, throttleStatus });
      await sleep(delay);
      return gql(query, variables, env, attempt + 1);
    }
    throw new Error("GraphQL errors: " + JSON.stringify(json.errors));
  }

  return json.data;
}

// ─── Fetch ALL variants with cursor pagination ────────────────────────────────

async function fetchAllVariants(productId, env) {
  const variants = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await gql(
      `query GetVariants($id: ID!, $cursor: String) {
         product(id: $id) {
           variants(first: 100, after: $cursor) {
             pageInfo { hasNextPage endCursor }
             edges {
               node {
                 id
                 selectedOptions { name value }
               }
             }
           }
         }
       }`,
      { id: productId, cursor },
      env
    );

    const page = data.product.variants;
    for (const { node } of page.edges) {
      variants.push(node);
    }
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return variants;
}

// ─── Bulk-update prices in batches of BATCH_SIZE ─────────────────────────────

async function bulkUpdatePrices(productId, variantUpdates, env) {
  let batchesProcessed = 0;

  for (let i = 0; i < variantUpdates.length; i += BATCH_SIZE) {
    const batch = variantUpdates.slice(i, i + BATCH_SIZE);

    const data = await gql(
      `mutation BulkSetPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
         productVariantsBulkUpdate(productId: $productId, variants: $variants) {
           userErrors { field message }
         }
       }`,
      { productId, variants: batch },
      env
    );

    const errors = data.productVariantsBulkUpdate.userErrors;
    if (errors.length > 0) {
      throw new Error(`Batch ${batchesProcessed + 1} failed: ` + JSON.stringify(errors));
    }

    batchesProcessed++;
  }

  return batchesProcessed;
}

// ─── Main logic ───────────────────────────────────────────────────────────────

async function processProduct(productId, env) {
  // Normalize to full GID — Flow may send a bare numeric ID
  const gid = String(productId).startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  log("log", "start", "Processing product", { product_id: gid });

  // Step 1 — Fetch product options + all custom metafields
  const { product } = await gql(
    `query GetProduct($id: ID!) {
       product(id: $id) {
         id
         title
         options { name optionValues { name } }
         metafields(first: 20, namespace: "custom") {
           edges { node { key value } }
         }
       }
     }`,
    { id: gid },
    env
  );

  if (!product) throw new Error(`Product not found: ${gid}`);

  // Step 2 — Guard: skip if Carat Size option already exists
  if (product.options.some((o) => o.name === "Carat Size")) {
    log("log", "guard", "Carat Size already exists — skipping", { product_id: gid });
    return { skipped: true, reason: "Carat Size option already exists" };
  }

  const warnings = [];

  // Step 3 — Parse metafields into a flat key→value map
  const mf = {};
  for (const { node } of product.metafields.edges) {
    mf[node.key] = node.value;
  }

  // Build ordered label array (smallest → largest carat)
  const labels = [
    mf["stone_weight_m_2"],
    mf["stone_weight_m_1"],
    mf["total_carat_range"],
    mf["stone_weight_p_1"],
    mf["stone_weight_p_2"],
  ].filter(Boolean);

  if (labels.length === 0) {
    throw new Error("No carat label metafields found — check stone_weight_* fields");
  }

  // Protection 2 — detect duplicate carat labels before building priceMap
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size !== labels.length) {
    const msg = "Duplicate carat labels detected — prices may be incorrect";
    log("warn", "metafields", msg, { product_id: gid, labels });
    warnings.push(msg);
  }

  // Map each label to its price
  const priceMap = {
    [mf["stone_weight_m_2"]]: mf["minus_2_size_ct"],
    [mf["stone_weight_m_1"]]: mf["minus_1_size_ct"],
    [mf["total_carat_range"]]: mf["original_price"],
    [mf["stone_weight_p_1"]]: mf["plus_1_size_ct"],
    [mf["stone_weight_p_2"]]: mf["plus_2_size_ct"],
  };

  log("log", "metafields", "Labels and price map parsed", { product_id: gid, labels });

  // Step 4 — Create "Carat Size" option (variantStrategy: CREATE builds all combos)
  const createData = await gql(
    `mutation CreateCaratOption($productId: ID!, $options: [OptionCreateInput!]!) {
       productOptionsCreate(
         productId: $productId
         options: $options
         variantStrategy: CREATE
       ) {
         userErrors { field message code }
       }
     }`,
    {
      productId: gid,
      options: [
        {
          name: "Carat Size",
          values: labels.map((l) => ({ name: l })),
        },
      ],
    },
    env
  );

  const { userErrors } = createData.productOptionsCreate;

  // Idempotency: if a race condition caused double-fire, skip cleanly instead of throwing
  if (userErrors.length > 0) {
    const alreadyExists = userErrors.some(
      (e) =>
        e.code === "TAKEN" ||
        e.code === "DUPLICATE" ||
        e.message?.toLowerCase().includes("already")
    );
    if (alreadyExists) {
      log("log", "idempotency", "Option already exists (race condition) — skipping", { product_id: gid });
      return { skipped: true, reason: "Carat Size option already exists (detected via userErrors)" };
    }
    throw new Error("productOptionsCreate failed: " + JSON.stringify(userErrors));
  }

  log("log", "options", "Carat Size option created", { product_id: gid, labels });

  // Step 5 — Fetch ALL variants via separate paginated query
  // Protection 1 — retry until Shopify finishes creating variants asynchronously
  const expectedCount = [...product.options.map((o) => o.optionValues.length), labels.length]
    .reduce((a, b) => a * b, 1);

  let allVariants = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    allVariants = await fetchAllVariants(gid, env);
    if (allVariants.length >= expectedCount) break;
    if (attempt < 4) {
      const delay = 500 * Math.pow(2, attempt);
      log("warn", "variants", `Only ${allVariants.length}/${expectedCount} variants ready — retrying in ${delay}ms`, { product_id: gid, attempt });
      await sleep(delay);
    }
  }
  if (allVariants.length < expectedCount) {
    const msg = `Variant count below expected — some may be unpriced`;
    log("warn", "variants", msg, { product_id: gid, expected: expectedCount, got: allVariants.length });
    warnings.push(msg);
  }
  log("log", "variants", `Fetched ${allVariants.length} variants`, { product_id: gid });

  // Step 6 — Build price updates with robust normalization
  const variantUpdates = [];
  let variantsSkipped = 0;

  for (const variant of allVariants) {
    const caratOpt = variant.selectedOptions.find((o) => o.name === "Carat Size");
    if (!caratOpt) continue;

    const rawPrice = priceMap[caratOpt.value];
    const numericPrice = parseFloat(String(rawPrice ?? "").replace(/[^0-9.]/g, ""));

    if (isNaN(numericPrice)) {
      const msg = `No valid price for carat "${caratOpt.value}" — skipping variant ${variant.id}`;
      log("warn", "price", msg, { product_id: gid, carat: caratOpt.value, rawPrice });
      warnings.push(msg);
      variantsSkipped++;
      continue;
    }

    variantUpdates.push({ id: variant.id, price: numericPrice.toFixed(2), inventoryItem: { tracked: true } });
  }

  if (variantUpdates.length === 0) {
    throw new Error("No variant prices to update — check price metafields");
  }

  // Step 7 — Bulk-set prices in batches
  const batchesProcessed = await bulkUpdatePrices(gid, variantUpdates, env);

  log("log", "done", "Complete", {
    product_id: gid,
    variantsUpdated: variantUpdates.length,
    variantsSkipped,
    batchesProcessed,
  });

  return {
    success: true,
    product: product.title,
    variantsUpdated: variantUpdates.length,
    variantsSkipped,
    batchesProcessed,
    caratLabels: labels,
    warnings,
  };
}
