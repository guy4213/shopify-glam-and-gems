/**
 * audit-filter-setup.mjs  —  READ-ONLY
 *
 * Produces a structured status report covering:
 *   1. Collection metafield definitions (custom namespace)
 *   2. Metaobject definitions (filter visual option type)
 *   3. Current metafield values on 4 key collections
 *   4. Existing metaobject entries (filter_visual_option)
 *
 * No mutations. No writes. Safe to run at any time.
 */

const DOMAIN      = 'glam-and-gems-2.myshopify.com';
const TOKEN       = (process.env.SHOPIFY_ADMIN_TOKEN || "");
const API_VERSION = '2025-04';
const GQL         = `https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

// ─── Transport ────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body:    JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(' | '));
  return json.data;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const W = 70;
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const CYAN  = '\x1b[36m';

const ok   = s => `${GREEN}✅ ${s}${RESET}`;
const err  = s => `${RED}❌ ${s}${RESET}`;
const warn = s => `${YELLOW}⚠️  ${s}${RESET}`;
const info = s => `${CYAN}ℹ️  ${s}${RESET}`;
const dim  = s => `${DIM}${s}${RESET}`;

function section(title) {
  console.log('\n' + '━'.repeat(W));
  console.log(`${BOLD}  ${title}${RESET}`);
  console.log('━'.repeat(W));
}

function row(label, status, detail = '') {
  const pad = 36;
  const lbl = label.padEnd(pad);
  const det = detail ? dim(`  ${detail}`) : '';
  console.log(`  ${lbl}${status}${det}`);
}

// ─── Expected keys ────────────────────────────────────────────────────────────

const EXPECTED_MF_KEYS = [
  'visual_filter_label_1',
  'visual_filter_label_2',
  'visual_filter_label_3',
  'visual_filter_label_4',
  'quick_filter_1',
  'quick_filter_2',
  'quick_filter_3',
  'quick_filter_4',
  'filter_visual_options',
];

const EXPECTED_MO_FIELDS = [
  'filter_label',
  'value_label',
  'display_label',
  'image',
  'color',
  'sort_order',
];

const TARGET_COLLECTIONS = [
  { handle: 'jewelry',          label: 'Jewelry'          },
  { handle: 'ready-to-ship',    label: 'Ready To Ship'    },
  { handle: 'wedding-rings',    label: 'Wedding Rings'    },
  { handle: 'engagement-rings', label: 'Engagement Rings' },
];

const VISUAL_LABEL_KEYS = [
  'custom.visual_filter_label_1',
  'custom.visual_filter_label_2',
  'custom.visual_filter_label_3',
  'custom.visual_filter_label_4',
  'custom.quick_filter_1',
  'custom.quick_filter_2',
  'custom.quick_filter_3',
  'custom.quick_filter_4',
  'custom.filter_visual_options',
];

// ─── Queries ──────────────────────────────────────────────────────────────────

const Q_METAFIELD_DEFS = `
  query {
    metafieldDefinitions(first: 100, ownerType: COLLECTION) {
      nodes {
        id
        namespace
        key
        name
        type { name }
        validations { name value }
        pinnedPosition
      }
    }
  }
`;

const Q_METAOBJECT_DEFS = `
  query {
    metaobjectDefinitions(first: 50) {
      nodes {
        id
        type
        name
        fieldDefinitions {
          key
          name
          type    { name }
          required
        }
      }
    }
  }
`;

// NOTE: In Shopify API 2025-04 the `keys` filter on metafields no longer
// accepts "namespace.key" dot format reliably.  Query by namespace only
// and filter client-side to avoid false nulls.
const Q_COLLECTION = `
  query($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      title
      handle
      metafields(first: 50, namespace: "custom") {
        nodes { namespace key value type }
      }
    }
  }
`;

const Q_MO_ENTRIES = `
  query($type: String!, $cursor: String) {
    metaobjects(type: $type, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        updatedAt
        filter_label:  field(key: "filter_label")  { value }
        value_label:   field(key: "value_label")   { value }
        display_label: field(key: "display_label") { value }
        color:         field(key: "color")         { value }
        image:         field(key: "image")         { value }
        sort_order:    field(key: "sort_order")    { value }
      }
    }
  }
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Header ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(W));
  console.log(`${BOLD}  SHOPIFY FILTER SETUP — STATUS AUDIT${RESET}`);
  console.log(`  Store   : ${DOMAIN}`);
  console.log(`  API     : ${API_VERSION}`);
  console.log(`  Mode    : READ-ONLY (no mutations)`);
  console.log('═'.repeat(W));

  // ══════════════════════════════════════════════════════════════════════════
  // 1. COLLECTION METAFIELD DEFINITIONS
  // ══════════════════════════════════════════════════════════════════════════
  section('1 · Collection Metafield Definitions  (custom namespace)');

  const mfData = await gql(Q_METAFIELD_DEFS);
  const allDefs = mfData.metafieldDefinitions.nodes;
  const customDefs = allDefs.filter(d => d.namespace === 'custom');

  // Index by key for quick lookup
  const defByKey = Object.fromEntries(customDefs.map(d => [d.key, d]));

  for (const key of EXPECTED_MF_KEYS) {
    const def = defByKey[key];
    if (!def) {
      row(`custom.${key}`, err('MISSING'));
    } else {
      const typeName = def.type.name;
      // Extra detail for list.metaobject_reference
      let typeDetail = typeName;
      if (typeName === 'list.metaobject_reference') {
        const moVal = def.validations.find(v => v.name === 'metaobject_definition_id');
        typeDetail = moVal
          ? `list.metaobject_reference → ${moVal.value}`
          : 'list.metaobject_reference (no validation)';
      }
      row(`custom.${key}`, ok('EXISTS'), typeDetail);
    }
  }

  // List any extra custom defs not in our expected set
  const extraDefs = customDefs.filter(d => !EXPECTED_MF_KEYS.includes(d.key));
  if (extraDefs.length > 0) {
    console.log(`\n  ${dim('Other custom metafield defs on COLLECTION:')}`);
    for (const d of extraDefs) {
      console.log(`  ${dim(`  • custom.${d.key}  (${d.type.name})`)}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. METAOBJECT DEFINITIONS
  // ══════════════════════════════════════════════════════════════════════════
  section('2 · Metaobject Definitions');

  const moDefData = await gql(Q_METAOBJECT_DEFS);
  const moDefs = moDefData.metaobjectDefinitions.nodes;

  if (moDefs.length === 0) {
    console.log('  ' + err('No metaobject definitions found in this store.'));
  } else {
    // Look for filter-related definitions
    const filterDef = moDefs.find(d =>
      d.type.includes('filter') || d.type.includes('visual')
    );

    for (const def of moDefs) {
      const isFilter = def === filterDef;
      const marker = isFilter ? `${GREEN}►${RESET} ` : '  ';
      console.log(`\n${marker}${BOLD}${def.name}${RESET}  ${dim(`(type: ${def.type})`)}  ${dim(def.id)}`);

      if (def.fieldDefinitions.length === 0) {
        console.log('    ' + warn('No field definitions found'));
      } else {
        for (const f of def.fieldDefinitions) {
          const expected = isFilter ? EXPECTED_MO_FIELDS.includes(f.key) : false;
          const reqFlag  = f.required ? dim(' [required]') : '';
          const status   = isFilter
            ? (expected ? ok('') : warn('unexpected key'))
            : '';
          console.log(`    • ${f.key.padEnd(18)} ${f.type.name.padEnd(30)}${reqFlag}  ${status}`);
        }

        if (isFilter) {
          const missing = EXPECTED_MO_FIELDS.filter(
            k => !def.fieldDefinitions.some(f => f.key === k)
          );
          if (missing.length > 0) {
            console.log('\n    ' + warn(`Missing expected fields: ${missing.join(', ')}`));
          } else {
            console.log('\n    ' + ok('All expected field keys present'));
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. CURRENT COLLECTION METAFIELD VALUES
  // ══════════════════════════════════════════════════════════════════════════
  section('3 · Current Collection Metafield Values');

  for (const { handle, label } of TARGET_COLLECTIONS) {
    const data = await gql(Q_COLLECTION, { handle });
    const col  = data.collectionByHandle;

    if (!col) {
      console.log(`\n  ${err(`"${label}" (handle: ${handle}) — collection not found`)}`);
      continue;
    }

    console.log(`\n  ${BOLD}"${col.title}"${RESET}  ${dim(col.id)}`);

    // Index by plain key (namespace already scoped to "custom" in the query)
    const mfByKey = Object.fromEntries(
      col.metafields.nodes.map(m => [m.key, m])
    );

    // Label metafields
    const labelKeys = [
      'visual_filter_label_1',
      'visual_filter_label_2',
      'visual_filter_label_3',
      'visual_filter_label_4',
    ];
    let anyLabel = false;
    for (const k of labelKeys) {
      const mf = mfByKey[k];
      const shortKey = k;
      if (!mf) {
        row(`  ${shortKey}`, warn('null / not set'));
      } else if (!mf.value?.trim()) {
        row(`  ${shortKey}`, warn('empty string'));
      } else {
        row(`  ${shortKey}`, ok(`"${mf.value}"`));
        anyLabel = true;
      }
    }

    // Quick filter metafields
    const quickKeys = [
      'quick_filter_1',
      'quick_filter_2',
      'quick_filter_3',
      'quick_filter_4',
    ];
    const quickVals = quickKeys
      .map(k => mfByKey[k]?.value)
      .filter(Boolean);
    if (quickVals.length > 0) {
      row('  quick_filter_1–4', ok(`[${quickVals.join(', ')}]`));
    } else {
      row('  quick_filter_1–4', warn('none set'));
    }

    // filter_visual_options
    const fvo = mfByKey['filter_visual_options'];
    if (!fvo) {
      row('  filter_visual_options', warn('not set'));
    } else {
      let parsed;
      try { parsed = JSON.parse(fvo.value); } catch { parsed = null; }
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        row('  filter_visual_options', warn('set but empty or invalid JSON'));
      } else {
        row('  filter_visual_options', ok(`${parsed.length} metaobject references linked`));
      }
    }

    // Overall verdict
    if (!anyLabel) {
      console.log('  ' + err('No visual_filter_label values set — board will not render'));
    } else if (!fvo || fvo.value === '[]') {
      console.log('  ' + warn('Labels set but filter_visual_options is empty — board renders fallback/placeholder only'));
    } else {
      console.log('  ' + ok('Labels + visual options both set — board should render'));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. EXISTING METAOBJECT ENTRIES
  // ══════════════════════════════════════════════════════════════════════════
  section('4 · Existing filter_visual_option Metaobject Entries');

  // Find the filter MO type from our earlier query
  const filterMoDef = moDefs.find(d =>
    d.type.includes('filter') || d.type.includes('visual')
  );

  if (!filterMoDef) {
    console.log('  ' + err('No filter_visual_option metaobject definition found — cannot query entries'));
  } else {
    const moType = filterMoDef.type;
    console.log(`  Querying type: ${BOLD}${moType}${RESET}\n`);

    // Paginate through all entries
    let cursor = null;
    let allEntries = [];
    do {
      const d = await gql(Q_MO_ENTRIES, { type: moType, cursor });
      allEntries.push(...d.metaobjects.nodes);
      cursor = d.metaobjects.pageInfo.hasNextPage
        ? d.metaobjects.pageInfo.endCursor
        : null;
    } while (cursor);

    if (allEntries.length === 0) {
      console.log('  ' + err('ZERO entries exist — metaobject entries have not been created yet'));
    } else {
      console.log(`  ${ok(`${allEntries.length} total entries found`)}\n`);

      // Group by filter_label for a cleaner view
      const byGroup = {};
      for (const e of allEntries) {
        const fl = e.filter_label?.value || '(no filter_label)';
        if (!byGroup[fl]) byGroup[fl] = [];
        byGroup[fl].push(e);
      }

      for (const [group, entries] of Object.entries(byGroup)) {
        console.log(`  ${BOLD}"${group}"${RESET}  ${dim(`(${entries.length} entries)`)}`);

        // Sort by sort_order if available
        entries.sort((a, b) =>
          (parseInt(a.sort_order?.value) || 999) - (parseInt(b.sort_order?.value) || 999)
        );

        for (const e of entries) {
          const vl      = e.value_label?.value   || dim('(no value_label)');
          const dl      = e.display_label?.value ? dim(` → "${e.display_label.value}"`) : '';
          const hasImg  = e.image?.value  ? ok('has image') : warn('no image');
          const hasCol  = e.color?.value  ? ok(`color: ${e.color.value}`) : '';
          const so      = e.sort_order?.value ? dim(` [#${e.sort_order.value}]`) : '';
          const extras  = [hasImg, hasCol].filter(Boolean).join('  ');

          console.log(`    • ${vl}${dl}${so}    ${extras}`);
        }
        console.log();
      }

      // Image coverage summary
      const withImg    = allEntries.filter(e => e.image?.value).length;
      const withColor  = allEntries.filter(e => e.color?.value).length;
      const missingImg = allEntries.filter(e => !e.image?.value && !e.color?.value).length;

      console.log('  Coverage summary:');
      row('  Entries with image',       withImg > 0    ? ok(withImg)    : warn(0),   `of ${allEntries.length}`);
      row('  Entries with color swatch',withColor > 0  ? ok(withColor)  : warn(0),   `of ${allEntries.length}`);
      row('  Entries with neither',     missingImg > 0 ? warn(missingImg): ok(0),    `(text-only chips)`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  section('SUMMARY');

  const mfDefs_ok     = EXPECTED_MF_KEYS.every(k => !!defByKey[k]);
  const moDefExists   = !!filterMoDef;
  const moFieldsOk    = filterMoDef
    ? EXPECTED_MO_FIELDS.every(k => filterMoDef.fieldDefinitions.some(f => f.key === k))
    : false;

  row('Metafield definitions (9 keys)', mfDefs_ok   ? ok('All present')  : warn('Some missing'));
  row('Metaobject definition exists',   moDefExists  ? ok('Yes')          : err('Missing'));
  row('Metaobject field schema correct',moFieldsOk   ? ok('All 6 fields') : warn('Fields differ'));

  console.log();
  console.log('  Collection label configuration:');
  for (const { handle, label } of TARGET_COLLECTIONS) {
    // Quick re-check from cached data is done inside the loop above;
    // here we emit a one-liner based on the handle's config presence.
    console.log(`    ${dim(`• ${label.padEnd(20)} → see Section 3 above`)}`);
  }

  console.log('\n' + '═'.repeat(W));
  console.log(`${BOLD}  END OF AUDIT REPORT${RESET}`);
  console.log('═'.repeat(W) + '\n');
}

main().catch(e => {
  console.error('\n❌  Audit failed:', e.message);
  process.exit(1);
});
