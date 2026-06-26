/**
 * delete-collections.mjs
 *
 * Deletes specific collections via the Shopify Admin GraphQL API.
 * 
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=glam-and-gems-2.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/delete-collections.mjs
 *
 *   Add --apply to actually run the mutations.
 */

import readline from 'readline';

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2024-10';
const APPLY  = process.argv.includes('--apply');

if (!DOMAIN || !TOKEN) {
  console.error('\n❌  Missing environment variables.');
  process.exit(1);
}

const GQL_ENDPOINT = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

const COLLECTIONS_TO_DELETE = [
  'gid://shopify/Collection/337055645886', // Duplicate "Ready To Ship"
  'gid://shopify/Collection/337102766270'  // Test collection "Shape_Pear"
];

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

const FETCH_COLLECTION = `
  query FetchCollection($id: ID!) {
    collection(id: $id) {
      id
      title
      handle
    }
  }
`;

const DELETE_MUTATION = `
  mutation DeleteCollection($id: ID!) {
    collectionDelete(input: { id: $id }) {
      deletedCollectionId
      userErrors {
        field
        message
      }
    }
  }
`;

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Shopify Collection Deleter');
  console.log(`  Store : ${DOMAIN}`);
  console.log(`  Mode  : ${APPLY ? '⚠️  APPLY (mutations will run)' : '🔍 DRY RUN (no changes)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const targets = [];
  
  for (const id of COLLECTIONS_TO_DELETE) {
    const data = await gql(FETCH_COLLECTION, { id });
    if (data.collection) {
      targets.push(data.collection);
    } else {
      console.log(`⚠️  Collection not found: ${id} (already deleted?)`);
    }
  }

  if (targets.length === 0) {
    console.log('\n✅ No collections found to delete. Exiting.\n');
    return;
  }

  console.log('Collections queued for deletion:');
  targets.forEach((c, i) => {
    console.log(`  ${i + 1}. "${c.title}" (Handle: ${c.handle}) [ID: ${c.id}]`);
  });

  if (!APPLY) {
    console.log('\n─────────────────────────────────────────────────────');
    console.log('  This was a DRY RUN. No changes were made.');
    console.log('  To apply, run with the --apply flag:');
    console.log(`\n  SHOPIFY_STORE_DOMAIN=${DOMAIN} SHOPIFY_ADMIN_TOKEN=<token> node scripts/delete-collections.mjs --apply\n`);
    return;
  }

  const answer = await prompt(
    `\n⚠️  You are about to PERMANENTLY DELETE ${targets.length} collections.\n` +
    `   Type YES to continue, anything else to abort: `
  );

  if (answer.trim().toUpperCase() !== 'YES') {
    console.log('\n🚫 Aborted. No changes were made.\n');
    return;
  }

  console.log('\n🗑️  Deleting collections...\n');
  
  for (const c of targets) {
    process.stdout.write(`  Deleting "${c.title}" ...`);
    try {
      const data = await gql(DELETE_MUTATION, { id: c.id });
      const result = data.collectionDelete;
      
      if (result.userErrors?.length) {
         console.log(` ❌  ${result.userErrors.map(e => e.message).join(', ')}`);
      } else {
         console.log(` ✅  Deleted successfully`);
      }
    } catch (e) {
      console.log(` ❌  ${e.message}`);
    }
  }
  console.log('\nDone.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
