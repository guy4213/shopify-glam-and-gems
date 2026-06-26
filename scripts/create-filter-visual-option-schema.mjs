/**
 * create-filter-visual-option-schema.mjs
 *
 * Step 1: Creates the `filter_visual_option` metaobject definition with 6 fields.
 * Step 2: Creates the `custom.filter_visual_options` collection metafield definition
 *         as a list of references to that metaobject type.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxx \
 *   node scripts/create-filter-visual-option-schema.mjs
 */

const DOMAIN      = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN       = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2025-04';

if (!DOMAIN || !TOKEN) {
  console.error('\n❌  Missing credentials.');
  console.error('    Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN before running.\n');
  process.exit(1);
}

const GQL = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gql(query, variables = {}) {
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

function hr() { console.log('━'.repeat(56)); }

// ─── Step 1: Create the metaobject definition ────────────────────────────────

const METAOBJECT_CREATE = `
  mutation MetaobjectDefinitionCreate($def: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $def) {
      metaobjectDefinition {
        id
        type
        name
        fieldDefinitions { key type { name } }
      }
      userErrors { field message code }
    }
  }
`;

const METAOBJECT_DEFINITION = {
  type: 'filter_visual_option',
  name: 'Filter Visual Option',
  displayNameKey: 'display_label',
  access: {
    storefront: 'PUBLIC_READ',
  },
  fieldDefinitions: [
    {
      key:         'filter_label',
      name:        'Filter Label',
      description: 'Matches the Shopify filter group label (e.g. "Diamond Shape"). Must match exactly.',
      type:        'single_line_text_field',
      required:    true,
      validations: [],
    },
    {
      key:         'value_label',
      name:        'Value Label',
      description: 'Matches the Shopify filter value label (e.g. "Round"). Used for functional filter matching.',
      type:        'single_line_text_field',
      required:    true,
      validations: [],
    },
    {
      key:         'display_label',
      name:        'Display Label',
      description: 'Optional override label shown in the UI. Falls back to value_label if blank.',
      type:        'single_line_text_field',
      required:    false,
      validations: [],
    },
    {
      key:         'image',
      name:        'Image',
      description: 'Optional image shown as a square tile (e.g. diamond shape outline).',
      type:        'file_reference',
      required:    false,
      validations: [{ name: 'file_type_options', value: '["Image"]' }],
    },
    {
      key:         'color',
      name:        'Color',
      description: 'Optional swatch color shown as a chip dot (e.g. for metal types).',
      type:        'color',
      required:    false,
      validations: [],
    },
    {
      key:         'sort_order',
      name:        'Sort Order',
      description: 'Optional integer to control display order within the group (lower = first).',
      type:        'number_integer',
      required:    false,
      validations: [],
    },
  ],
};

// ─── Step 2: Create the collection metafield definition ──────────────────────

const METAFIELD_DEF_CREATE = `
  mutation MetafieldDefinitionCreate($def: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $def) {
      createdDefinition {
        id
        name
        namespace
        key
        type { name }
      }
      userErrors { field message code }
    }
  }
`;

// ─── Step 2 query: look up the metaobject definition GID by type ─────────────

const METAOBJECT_DEF_QUERY = `
  query GetMetaobjectDef($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      fieldDefinitions { key type { name } }
    }
  }
`;

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  hr();
  console.log('  Filter Visual Option — Schema Deployment');
  console.log(`  Store : ${DOMAIN}`);
  console.log(`  API   : ${API_VERSION}`);
  hr();

  // ── Step 1: Metaobject definition ──────────────────────────────────────────
  console.log('\n[1/2]  Creating metaobject definition: filter_visual_option\n');

  let metaobjectGid;
  try {
    const data = await gql(METAOBJECT_CREATE, { def: METAOBJECT_DEFINITION });
    const result = data.metaobjectDefinitionCreate;

    if (result.userErrors?.length) {
      const errs = result.userErrors.map(e => `${e.field}: ${e.message} (${e.code})`);
      const isTaken = result.userErrors.some(e =>
        e.code === 'TAKEN' || e.message.toLowerCase().includes('already') || e.message.toLowerCase().includes('taken')
      );

      if (isTaken) {
        console.log('  ⚠️   Metaobject type already exists — looking up its GID...');
        const q = await gql(METAOBJECT_DEF_QUERY, { type: 'filter_visual_option' });
        metaobjectGid = q.metaobjectDefinitionByType.id;
        console.log(`      GID : ${metaobjectGid}`);
      } else {
        console.error(`  ❌  ${errs.join(' | ')}`);
        process.exit(1);
      }
    } else {
      const def = result.metaobjectDefinition;
      metaobjectGid = def.id;
      console.log(`  ✅  Created metaobject definition`);
      console.log(`      ID   : ${def.id}`);
      console.log(`      Type : ${def.type}`);
      console.log(`      Fields:`);
      for (const f of def.fieldDefinitions) {
        console.log(`        • ${f.key.padEnd(16)} (${f.type.name})`);
      }
    }
  } catch (e) {
    console.error(`  ❌  Fatal: ${e.message}`);
    process.exit(1);
  }

  await sleep(600);

  // ── Step 2: Collection metafield definition ────────────────────────────────
  console.log('\n[2/2]  Creating collection metafield: custom.filter_visual_options\n');
  console.log(`       Using metaobject GID: ${metaobjectGid}`);

  try {
    const data = await gql(METAFIELD_DEF_CREATE, {
      def: {
        name:        'Filter Visual Options',
        namespace:   'custom',
        key:         'filter_visual_options',
        description: 'Ordered list of Filter Visual Option metaobjects that configure the visual filter board for this collection.',
        type:        'list.metaobject_reference',
        ownerType:   'COLLECTION',
        pin:         true,
        access: {
          storefront: 'PUBLIC_READ',
        },
        validations: [
          {
            name:  'metaobject_definition_id',
            value: metaobjectGid,
          },
        ],
      },
    });

    const result = data.metafieldDefinitionCreate;

    if (result.userErrors?.length) {
      const isTaken = result.userErrors.some(e =>
        e.code === 'TAKEN' || e.message.toLowerCase().includes('already') || e.message.toLowerCase().includes('taken')
      );
      if (isTaken) {
        console.log('  ⚠️   Metafield definition already exists — nothing to do.');
      } else {
        console.error(`  ❌  ${result.userErrors.map(e => e.message).join(', ')}`);
        process.exit(1);
      }
    } else {
      const def = result.createdDefinition;
      console.log(`  ✅  Created collection metafield definition`);
      console.log(`      ID  : ${def.id}`);
      console.log(`      Key : ${def.namespace}.${def.key}`);
      console.log(`      Type: ${def.type.name}`);
    }
  } catch (e) {
    console.error(`  ❌  Fatal: ${e.message}`);
    process.exit(1);
  }

  hr();
  console.log('\n  All done. Next steps:');
  console.log('  1. In Shopify Admin → Content → Metaobjects → "Filter Visual Option"');
  console.log('     create entries for each shape/style/metal option your collections need.');
  console.log('  2. Open each collection → scroll to "Filter Visual Options" metafield');
  console.log('     and assign the relevant metaobject entries in display order.');
  console.log('  3. Shopify Liquid reads them live — no theme redeploy needed.\n');
  hr();
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
