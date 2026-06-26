const DOMAIN = "glam-and-gems-2.myshopify.com";
const TOKEN  = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const GQL    = `https://${DOMAIN}/admin/api/2025-04/graphql.json`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

const CREATE_COLLECTION = `
  mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id title handle }
      userErrors { field message }
    }
  }
`;

const METAFIELDS_SET = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

// Collections to create + their filter board config
const COLLECTIONS = [
  {
    input: {
      title: 'Jewelry',
      handle: 'jewelry',
      descriptionHtml: 'Explore our full jewelry collection — engagement rings, wedding rings, necklaces, earrings, bracelets and fashion rings.',
      sortOrder: 'MANUAL',
    },
    filterLabels: {
      l1: 'Style', l2: 'Metal', l3: 'Diamond Shape', l4: 'Price',
      q: ['Ready To Ship', 'On Sale', 'New Arrival', 'Best Sellers'],
    },
  },
  {
    input: {
      title: 'Moissanite',
      handle: 'moissanite',
      descriptionHtml: 'Discover our Moissanite jewelry collection — the brilliant, sustainable alternative to diamonds.',
      sortOrder: 'MANUAL',
    },
    filterLabels: {
      l1: 'Diamond Shape', l2: 'Style', l3: 'Metal', l4: 'Price',
      q: ['Ready To Ship', 'On Sale', 'New Arrival', 'Best Sellers'],
    },
  },
  {
    input: {
      title: 'Education',
      handle: 'education',
      descriptionHtml: 'Learn everything about diamonds, gemstones, metals and ring settings to make the perfect choice.',
      sortOrder: 'MANUAL',
    },
    filterLabels: null, // informational — no filter board
  },
];

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Creating missing collections');
console.log(`  Store: ${DOMAIN}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const col of COLLECTIONS) {
  process.stdout.write(`  Creating "${col.input.title}" (/${col.input.handle}) ...`);

  try {
    const data = await gql(CREATE_COLLECTION, { input: col.input });
    const result = data.collectionCreate;

    if (result.userErrors?.length) {
      console.log(` ❌  ${result.userErrors.map(e => e.message).join(', ')}`);
      continue;
    }

    const { id, handle } = result.collection;
    console.log(` ✅  Created (ID: ${id.split('/').pop()})`);

    // Set filter metafields if defined
    if (col.filterLabels) {
      const { l1, l2, l3, l4, q } = col.filterLabels;
      const mfs = [];
      const add = (key, value) => { if (value?.trim()) mfs.push({ ownerId: id, namespace: 'custom', key, type: 'single_line_text_field', value }); };
      add('visual_filter_label_1', l1);
      add('visual_filter_label_2', l2);
      add('visual_filter_label_3', l3);
      add('visual_filter_label_4', l4);
      add('quick_filter_1', q[0]);
      add('quick_filter_2', q[1]);
      add('quick_filter_3', q[2]);
      add('quick_filter_4', q[3]);

      await sleep(300);
      process.stdout.write(`         Setting filter labels: ${[l1,l2,l3,l4].filter(Boolean).join(' › ')} ...`);
      const mfData = await gql(METAFIELDS_SET, { metafields: mfs });
      if (mfData.metafieldsSet.userErrors?.length) {
        console.log(` ❌  ${mfData.metafieldsSet.userErrors.map(e => e.message).join(', ')}`);
      } else {
        console.log(' ✅');
      }
    } else {
      console.log(`         No filter board (informational collection)`);
    }

  } catch (e) {
    console.log(` ❌  ${e.message}`);
  }

  await sleep(400);
}

// Also set filter config on ready-to-ship (exists but had no config)
console.log('\n  Setting filter labels on existing "ready-to-ship"...');
try {
  // Get its ID first
  const data = await gql(`{ collectionByHandle(handle: "ready-to-ship") { id } }`);
  const id = data.collectionByHandle?.id;
  if (!id) throw new Error('not found');

  const mfs = [
    { ownerId: id, namespace: 'custom', key: 'visual_filter_label_1', type: 'single_line_text_field', value: 'Style' },
    { ownerId: id, namespace: 'custom', key: 'visual_filter_label_2', type: 'single_line_text_field', value: 'Metal' },
    { ownerId: id, namespace: 'custom', key: 'visual_filter_label_3', type: 'single_line_text_field', value: 'Diamond Shape' },
    { ownerId: id, namespace: 'custom', key: 'visual_filter_label_4', type: 'single_line_text_field', value: 'Price' },
    { ownerId: id, namespace: 'custom', key: 'quick_filter_1', type: 'single_line_text_field', value: 'On Sale' },
    { ownerId: id, namespace: 'custom', key: 'quick_filter_2', type: 'single_line_text_field', value: 'New Arrival' },
    { ownerId: id, namespace: 'custom', key: 'quick_filter_3', type: 'single_line_text_field', value: 'Best Sellers' },
  ];
  const mfData = await gql(METAFIELDS_SET, { metafields: mfs });
  if (mfData.metafieldsSet.userErrors?.length) {
    console.log(`  ❌  ${mfData.metafieldsSet.userErrors.map(e => e.message).join(', ')}`);
  } else {
    console.log('  ✅  ready-to-ship — Style › Metal › Diamond Shape › Price');
  }
} catch (e) {
  console.log(`  ❌  ${e.message}`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
