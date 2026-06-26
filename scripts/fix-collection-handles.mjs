/**
 * fix-collection-handles.mjs
 *
 * Audits all Shopify collection handles and fixes any that don't match
 * what they should be based on the collection title.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=glam-and-gems-2.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/fix-collection-handles.mjs
 *
 *   Add --apply to actually run the mutations (default is dry-run only).
 */

import readline from 'readline';

// ─── Config ──────────────────────────────────────────────────────────────────

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2024-10';
const APPLY  = process.argv.includes('--apply');

if (!DOMAIN || !TOKEN) {
  console.error('\n❌  Missing environment variables.');
  console.error('    Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN before running.\n');
  process.exit(1);
}

const GQL_ENDPOINT = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

// ─── Shopify GraphQL helper ───────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(GQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL errors:\n${json.errors.map(e => `  • ${e.message}`).join('\n')}`);
  }

  return json.data;
}

// ─── Reserved handles that must never be changed ─────────────────────────────

/**
 * Shopify reserves 'frontpage' as the handle for the homepage collection.
 * Changing it breaks the homepage. Always skip it.
 */
const SKIP_HANDLES = new Set(['frontpage']);

// ─── Handle generation ────────────────────────────────────────────────────────

/**
 * Converts a collection title to a Shopify-compatible handle.
 * Rules (matches Shopify's own slug logic):
 *   - Lowercase
 *   - & → stripped (not "and"), consistent with existing clean handles like "necklaces-pendants"
 *   - Any character that is not a-z, 0-9 → hyphen
 *   - Collapse consecutive hyphens → single hyphen
 *   - Trim leading/trailing hyphens
 */
function titleToHandle(title) {
  return title
    .toLowerCase()
    .replace(/&/g, '')            // strip ampersands
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphen
    .replace(/-{2,}/g, '-')       // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');     // trim edges
}

// ─── Fetch all collections (paginated) ───────────────────────────────────────

const COLLECTIONS_QUERY = `
  query FetchCollections($cursor: String) {
    collections(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`;

async function fetchAllCollections() {
  const collections = [];
  let cursor = null;
  let page = 1;

  while (true) {
    process.stdout.write(`  Fetching page ${page}...`);
    const data = await gql(COLLECTIONS_QUERY, { cursor });
    const { edges, pageInfo } = data.collections;

    for (const { node } of edges) {
      collections.push(node);
    }

    console.log(` ${edges.length} collections.`);

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
    page++;

    // Respect Shopify rate limits (250ms between pages)
    await sleep(250);
  }

  return collections;
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

const UPDATE_MUTATION = `
  mutation UpdateCollectionHandle($id: ID!, $input: CollectionInput!) {
    collectionUpdate(input: { id: $id, handle: $input }) {
      collection {
        id
        title
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Simpler mutation signature that works reliably
const UPDATE_HANDLE_MUTATION = `
  mutation UpdateCollectionHandle($id: ID!, $handle: String!) {
    collectionUpdate(input: { id: $id, handle: $handle }) {
      collection {
        id
        title
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function updateHandle(id, handle) {
  const data = await gql(UPDATE_HANDLE_MUTATION, { id, handle });
  const result = data.collectionUpdate;

  if (result.userErrors?.length) {
    return {
      ok: false,
      errors: result.userErrors.map(e => `${e.field}: ${e.message}`).join(', '),
    };
  }

  return { ok: true, newHandle: result.collection.handle };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

function padEnd(str, len) {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Shopify Collection Handle Fixer');
  console.log(`  Store : ${DOMAIN}`);
  console.log(`  Mode  : ${APPLY ? '⚠️  APPLY (mutations will run)' : '🔍 DRY RUN (no changes)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Fetch all collections
  console.log('📦 Fetching collections...');
  const collections = await fetchAllCollections();
  console.log(`\n✅ Total collections fetched: ${collections.length}\n`);

  // 2. Identify mismatches
  const mismatches = [];
  const skipped    = [];

  for (const col of collections) {
    const proposed = titleToHandle(col.title);

    if (SKIP_HANDLES.has(col.handle)) {
      console.log(`  ⏭  Skipping reserved handle: "${col.title}" (${col.handle})`);
      skipped.push({ ...col, proposed: col.handle });
    } else if (proposed === col.handle) {
      skipped.push({ ...col, proposed });
    } else {
      mismatches.push({ ...col, proposed });
    }
  }

  // 3. Print dry-run report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Already correct : ${skipped.length} collections`);
  console.log(`  ❌ Need fixing     : ${mismatches.length} collections`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (mismatches.length === 0) {
    console.log('🎉 All handles are already correct. Nothing to do.\n');
    return;
  }

  // Print table
  const col1 = 38, col2 = 42, col3 = 42;
  const header = padEnd('TITLE', col1) + padEnd('CURRENT HANDLE', col2) + 'PROPOSED HANDLE';
  const divider = '─'.repeat(col1 + col2 + col3);

  console.log(header);
  console.log(divider);

  for (const col of mismatches) {
    const row =
      padEnd(col.title, col1) +
      padEnd(col.handle, col2) +
      col.proposed;
    console.log(row);
  }

  console.log(divider);
  console.log(`\n${mismatches.length} collections will be updated.\n`);

  // 4. Special warnings
  const warnings = mismatches.filter(c =>
    c.handle === 'frontpage' ||
    c.title === 'Home page'
  );
  if (warnings.length) {
    console.log('⚠️  WARNING: The following collections have special handles.');
    console.log('   Review carefully before applying:\n');
    for (const w of warnings) {
      console.log(`   "${w.title}"  ${w.handle}  →  ${w.proposed}`);
    }
    console.log('');
  }

  // 5. If dry-run only, stop here
  if (!APPLY) {
    console.log('─────────────────────────────────────────────────────');
    console.log('  This was a DRY RUN. No changes were made.');
    console.log('  To apply, run with the --apply flag:');
    console.log(`\n  SHOPIFY_STORE_DOMAIN=${DOMAIN} SHOPIFY_ADMIN_TOKEN=<token> node scripts/fix-collection-handles.mjs --apply\n`);
    return;
  }

  // 6. Ask for confirmation before mutating
  const answer = await prompt(
    `⚠️  You are about to update ${mismatches.length} collection handles on ${DOMAIN}.\n` +
    `   This CANNOT be undone automatically (old handles will stop working).\n` +
    `   Type YES to continue, anything else to abort: `
  );

  if (answer.trim().toUpperCase() !== 'YES') {
    console.log('\n🚫 Aborted. No changes were made.\n');
    return;
  }

  // 7. Run mutations
  console.log('\n🔄 Applying updates...\n');

  const results = { ok: [], failed: [] };

  for (let i = 0; i < mismatches.length; i++) {
    const col = mismatches[i];
    const prefix = `  [${String(i + 1).padStart(3, '0')}/${mismatches.length}]`;

    process.stdout.write(`${prefix} "${col.title}" ...`);

    try {
      const result = await updateHandle(col.id, col.proposed);

      if (result.ok) {
        console.log(` ✅  ${col.handle}  →  ${result.newHandle}`);
        results.ok.push(col);
      } else {
        console.log(` ❌  ${result.errors}`);
        results.failed.push({ ...col, error: result.errors });
      }
    } catch (err) {
      console.log(` ❌  ${err.message}`);
      results.failed.push({ ...col, error: err.message });
    }

    // Shopify rate limit: stay well within the 2 req/s burst limit
    await sleep(600);
  }

  // 8. Final summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Updated successfully : ${results.ok.length}`);
  console.log(`  ❌ Failed               : ${results.failed.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.failed.length > 0) {
    console.log('Failed collections:');
    for (const f of results.failed) {
      console.log(`  • "${f.title}" (${f.handle}) — ${f.error}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
