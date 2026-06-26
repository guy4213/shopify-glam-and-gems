# Carat Size Automation — Build Plan

## Goal
When a tech guy uploads a product with the correct metafields,
the system automatically creates the Carat Size option + all variants with correct prices.
Zero manual work.

---

## How It Works (Flow)

```
Tech guy uploads product + fills 10 metafields
            ↓
Shopify Flow detects: isDiamond = "yes"
            ↓
Flow sends HTTP POST → Cloudflare Worker (free)
            ↓
Worker reads metafields from Admin API
            ↓
Worker calls Admin API:
  1. productOptionsCreate → adds "Carat Size" option
  2. variantsBulkUpdate  → sets price per variant
            ↓
Done. 120 variants built. No manual work.
```

---

## Metafield Schema (already set up on products)

| Metafield | Type | Example | Meaning |
|---|---|---|---|
| `custom.isDiamond` | text | `"yes"` | Trigger flag |
| `custom.center_stone_weight` | number | `5.0` | Base carat (center option) |
| `custom.total_carat_range` | text | `"5 Carat"` | Label for center option |
| `custom.stone_weight_m_1` | text | `"4 Carat"` | Label: 1 below center |
| `custom.stone_weight_m_2` | text | `"3 Carat"` | Label: 2 below center |
| `custom.stone_weight_p_1` | text | `"6 Carat"` | Label: 1 above center |
| `custom.stone_weight_p_2` | text | `"7 Carat"` | Label: 2 above center |
| `custom.original_price` | number | `3775.0` | Price for center carat |
| `custom.minus_1_size_ct` | number | `1230.0` | Price: 1 below center |
| `custom.minus_2_size_ct` | number | `1110.0` | Price: 2 below center |
| `custom.plus_1_size_ct` | number | `1470.0` | Price: 1 above center |
| `custom.plus_2_size_ct` | number | `1590.0` | Price: 2 above center |

Carat Size values array built by Worker:
```
[stone_weight_m_2, stone_weight_m_1, total_carat_range, stone_weight_p_1, stone_weight_p_2]
= ["3 Carat", "4 Carat", "5 Carat", "6 Carat", "7 Carat"]
```

Price map built by Worker:
```
stone_weight_m_2 → minus_2_size_ct  = $1110
stone_weight_m_1 → minus_1_size_ct  = $1230
total_carat_range → original_price  = $3775
stone_weight_p_1 → plus_1_size_ct   = $1470
stone_weight_p_2 → plus_2_size_ct   = $1590
```

---

## What We Need to Build

### Part 1 — Cloudflare Worker (JS, ~60 lines)

File: `worker.js`

Logic:
1. Receive POST request from Flow: `{ product_id: "gid://shopify/Product/XXXXX" }`
2. Validate secret token (so only Flow can call it)
3. Fetch all metafields from Admin API
4. Check: Carat Size option doesn't already exist (prevent duplicate runs)
5. Build labels array + price map from metafields
6. Call `productOptionsCreate` mutation → creates Carat Size option + new variant skeleton
7. Fetch all newly created variants
8. For each variant: look up its Carat Size value → get price from map
9. Call `productVariantsBulkUpdate` → set prices
10. Return 200 OK

Environment variables needed in Cloudflare dashboard:
```
SHOPIFY_TOKEN=shpat_REDACTED_ROTATE_THIS_TOKEN
SHOPIFY_SHOP=glam-and-gems-2.myshopify.com
WORKER_SECRET=<random string we choose>
```

Deploy: Cloudflare dashboard → Workers → New Worker → paste → deploy
URL will be: `https://glam-carat-worker.YOUR_ACCOUNT.workers.dev`

---

### Part 2 — Shopify Flow Workflow

Location: Shopify Admin → Apps → Flow → Create Workflow

**Trigger:** Product created OR Product updated

**Condition 1:** `product.metafields.custom.isDiamond` equals `"yes"`

**Condition 2:** Product does NOT already have an option named `"Carat Size"`
(prevents re-running on products already processed)

**Action:** Send HTTP Request
- Method: POST
- URL: `https://glam-carat-worker.YOUR_ACCOUNT.workers.dev`
- Headers:
  - `Content-Type: application/json`
  - `X-Worker-Secret: <WORKER_SECRET>`
- Body:
  ```json
  { "product_id": "{{ product.id }}" }
  ```

---

## Tech Guy Checklist (per product upload)

When uploading a diamond product, these fields must be filled:

```
☐ custom.isDiamond          = "yes"
☐ custom.center_stone_weight = (number, e.g. 5.0)
☐ custom.total_carat_range  = (e.g. "5 Carat")
☐ custom.stone_weight_m_1   = (e.g. "4 Carat")
☐ custom.stone_weight_m_2   = (e.g. "3 Carat")
☐ custom.stone_weight_p_1   = (e.g. "6 Carat")
☐ custom.stone_weight_p_2   = (e.g. "7 Carat")
☐ custom.original_price     = (number, base carat price)
☐ custom.minus_1_size_ct    = (number)
☐ custom.minus_2_size_ct    = (number)
☐ custom.plus_1_size_ct     = (number)
☐ custom.plus_2_size_ct     = (number)
```

Base variants must already include:
```
☐ Metal Type:  Yellow Gold / White Gold / Rose Gold
☐ Ring Size:   4 / 4.5 / 5 / 5.5 / 6 / 6.5 / 7 / 7.5 / ... (all sizes)
```

Flow handles the rest.

---

## Build Session Checklist

- [x] Write `worker.js` (Cloudflare Worker code)
- [ ] Deploy Worker to Cloudflare (free account)
- [ ] Set environment variables in Cloudflare dashboard
- [ ] Create Shopify Flow workflow
- [ ] Test with a staging/copy product
- [ ] Confirm 120 variants created with correct prices
- [ ] Done

Estimated time: ~45 minutes

---

## Worker Logic (worker.js — already written)

The file `worker.js` lives in the root of this project. It does:

1. Receives POST from Flow — validates `X-Worker-Secret` header, rejects anything else
2. Fetches the product — gets current options + all `custom.*` metafields via GraphQL
3. Guard check — if "Carat Size" option already exists, returns `skipped: true` and stops (prevents double-runs)
4. Builds label array + price map from metafields:
   - Labels: `["3 Carat", "4 Carat", "5 Carat", "6 Carat", "7 Carat"]`
   - Prices: each label → its matching `minus_2/minus_1/original/plus_1/plus_2` number
5. `productOptionsCreate` — adds the "Carat Size" option with `variantStrategy: CREATE`, so Shopify auto-generates all combinations (e.g. 24 existing × 5 carats = 120 variants)
6. `productVariantsBulkUpdate` — sets the correct price on every new variant based on its Carat Size value
7. Returns JSON — `{ success, product, variantsUpdated, caratLabels }` visible in Flow's run log

---

## How to Deploy & Test

### Step 1 — Deploy to Cloudflare
1. Go to dash.cloudflare.com → **Workers & Pages** → **Create Application** → **Create Worker**
2. Paste the contents of `worker.js` → **Save and Deploy**
3. Note your worker URL: `https://glam-carat-worker.YOUR_ACCOUNT.workers.dev`

### Step 2 — Set environment variables
In the Worker's **Settings → Variables** tab, add:
```
SHOPIFY_TOKEN  = shpat_REDACTED_ROTATE_THIS_TOKEN
SHOPIFY_SHOP   = glam-and-gems-2.myshopify.com
WORKER_SECRET  = (any random string you pick, e.g. glamgems2024abc)
```

### Step 3 — Test the worker directly (before setting up Flow)
Create a test product in Shopify admin with:
- Metal Type + Ring Size variants already set up
- All 10 `custom.*` metafields filled in
- `custom.isDiamond = "yes"`

Then fire a manual POST:
```bash
curl -X POST https://glam-carat-worker.YOUR_ACCOUNT.workers.dev \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: glamgems2024abc" \
  -d '{"product_id": "gid://shopify/Product/YOUR_TEST_PRODUCT_ID"}'
```

Expected response:
```json
{ "success": true, "product": "Test Ring", "variantsUpdated": 120, "caratLabels": ["3 Carat","4 Carat","5 Carat","6 Carat","7 Carat"] }
```

### Step 4 — Set up Shopify Flow
- **Trigger:** Product created
- **Condition 1:** `product.metafields.custom.isDiamond` equals `"yes"`
- **Condition 2:** Product does NOT have option named `"Carat Size"`
- **Action:** Send HTTP Request
  - Method: POST
  - URL: `https://glam-carat-worker.YOUR_ACCOUNT.workers.dev`
  - Headers: `Content-Type: application/json`, `X-Worker-Secret: <your secret>`
  - Body: `{ "product_id": "{{ product.id }}" }`

### What to verify after a test run

| Check | Where |
|---|---|
| 120 variants exist | Shopify Admin → Product → Variants |
| Prices correct per carat | Each variant's price matches the metafield |
| Worker log shows success | Cloudflare dashboard → Worker → Logs |
| Flow run shows 200 OK | Shopify Admin → Flow → Run history |
