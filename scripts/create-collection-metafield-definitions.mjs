/**
 * create-collection-metafield-definitions.mjs
 * Creates the 6 required collection metafield definitions in Shopify Admin.
 */

const DOMAIN  = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2024-10';

if (!DOMAIN || !TOKEN) {
  console.error('❌  Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

const GQL = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

const DEFINITIONS = [
  {
    name: 'Subtitle',
    namespace: 'custom',
    key: 'subtitle',
    type: 'single_line_text_field',
    description: 'Short tagline shown below the collection title in the banner',
  },
  {
    name: 'Intro Text',
    namespace: 'custom',
    key: 'intro_text',
    type: 'multi_line_text_field',
    description: 'Longer intro paragraph shown below the banner',
  },
  {
    name: 'Hero Image',
    namespace: 'custom',
    key: 'hero_image',
    type: 'file_reference',
    description: 'Override image for the collection banner hero (falls back to collection.image)',
  },
  {
    name: 'Visual Filter Label 1',
    namespace: 'custom',
    key: 'visual_filter_label_1',
    type: 'single_line_text_field',
    description: 'Shopify filter label to render as the first visual image filter carousel',
  },
  {
    name: 'Visual Filter Label 2',
    namespace: 'custom',
    key: 'visual_filter_label_2',
    type: 'single_line_text_field',
    description: 'Shopify filter label to render as the second visual image filter carousel',
  },
  {
    name: 'Promo Banner',
    namespace: 'custom',
    key: 'promo_banner_html',
    type: 'multi_line_text_field',
    description: 'HTML promotional strip shown above the product grid. Renders nothing if blank.',
  },
];

const MUTATION = `
  mutation CreateDef($def: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $def) {
      createdDefinition {
        id
        name
        namespace
        key
        type { name }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

async function gql(query, variables) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Creating Collection Metafield Definitions');
  console.log(`  Store: ${DOMAIN}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let created = 0, failed = 0;

  for (const def of DEFINITIONS) {
    process.stdout.write(`  ${def.namespace}.${def.key} (${def.type}) ...`);
    try {
      const data = await gql(MUTATION, {
        def: {
          name: def.name,
          namespace: def.namespace,
          key: def.key,
          type: def.type,
          ownerType: 'COLLECTION',
          description: def.description,
          pin: true,
        },
      });

      const result = data.metafieldDefinitionCreate;
      if (result.userErrors?.length) {
        const msg = result.userErrors.map(e => e.message).join(', ');
        // "already exists" is fine — treat as success
        if (msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
          console.log(` ⚠️  Already exists — skipping`);
          created++;
        } else {
          console.log(` ❌  ${msg}`);
          failed++;
        }
      } else if (result.createdDefinition) {
        console.log(` ✅  Created (ID: ${result.createdDefinition.id.split('/').pop()})`);
        created++;
      }
    } catch (e) {
      console.log(` ❌  ${e.message}`);
      failed++;
    }

    await sleep(400);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✅ Succeeded : ${created}`);
  console.log(`  ❌ Failed    : ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
