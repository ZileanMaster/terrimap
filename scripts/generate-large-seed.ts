import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const COLS = 25
const ROWS = 20

// Hanoi bounds (tight bounding box, enough for algorithm testing)
const lngMin = 105.81
const lngMax = 105.86
const latMin = 21.0
const latMax = 21.048

type Pt = [number, number] // [lng, lat]

function centroidOfRing(ring: number[][]) {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + (p[1] ?? 0), 0) / pts.length
  const lng = pts.reduce((s, p) => s + (p[0] ?? 0), 0) / pts.length
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 }
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// Variable-width cuts, deterministic, to avoid a perfect grid look.
function buildCuts(min: number, max: number, n: number, rand: () => number): number[] {
  const total = max - min
  const raw = Array.from({ length: n }, () => 0.5 + rand()) // [0.5, 1.5]
  const sum = raw.reduce((s, x) => s + x, 0)
  const cuts: number[] = [min]
  let acc = min
  for (let i = 0; i < n; i++) {
    acc += (raw[i]! / sum) * total
    cuts.push(acc)
  }
  cuts[cuts.length - 1] = max
  return cuts
}

function makeVerticalSegment(x: number, y0: number, y1: number, maxDx: number, rand: () => number): Pt[] {
  // Multi-point polyline so boundaries are not straight edges.
  const t1 = 0.22 + rand() * 0.18
  const t2 = 0.5 + rand() * 0.1
  const t3 = 0.78 + rand() * 0.18
  const dx1 = (rand() * 2 - 1) * maxDx
  const dx2 = (rand() * 2 - 1) * maxDx
  const dx3 = (rand() * 2 - 1) * maxDx
  return [
    [x, y0],
    [x + dx1, y0 + (y1 - y0) * t1],
    [x + dx2, y0 + (y1 - y0) * t2],
    [x + dx3, y0 + (y1 - y0) * t3],
    [x, y1],
  ]
}

function makeHorizontalSegment(y: number, x0: number, x1: number, maxDy: number, rand: () => number): Pt[] {
  const t1 = 0.22 + rand() * 0.18
  const t2 = 0.5 + rand() * 0.1
  const t3 = 0.78 + rand() * 0.18
  const dy1 = (rand() * 2 - 1) * maxDy
  const dy2 = (rand() * 2 - 1) * maxDy
  const dy3 = (rand() * 2 - 1) * maxDy
  return [
    [x0, y],
    [x0 + (x1 - x0) * t1, y + dy1],
    [x0 + (x1 - x0) * t2, y + dy2],
    [x0 + (x1 - x0) * t3, y + dy3],
    [x1, y],
  ]
}

function stitch(edges: Pt[][]): number[][] {
  const ring: Pt[] = []
  for (const e of edges) {
    for (const p of e) {
      if (ring.length > 0) {
        const last = ring[ring.length - 1]!
        if (last[0] === p[0] && last[1] === p[1]) continue
      }
      ring.push(p)
    }
  }
  const first = ring[0]!
  const last = ring[ring.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  return ring as unknown as number[][]
}

const sqlLines: string[] = [
  '--',
  '-- TERRIMAP SEED LARGE DATASET (500 ZONES & 20 SALES AGENTS IN HANOI)',
  '-- Generated dynamically by scripts/generate-large-seed.ts',
  '--',
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
  '',
  'DO $$',
  'DECLARE',
  '  v_project_id TEXT;',
  '  v_region_hn TEXT;',
  '  v_sales_id UUID;',
]

// Declare 19 variables for UUIDs
for (let i = 1; i <= 19; i++) {
  sqlLines.push(`  v_sales_hn_${i}_id UUID := gen_random_uuid();`)
}

sqlLines.push(
  'BEGIN',
  "  -- Get the test project ID specifically",
  "  SELECT id INTO v_project_id FROM public.projects WHERE id = 'test-project-terrimap' OR owner_id = (SELECT id FROM auth.users WHERE email = 'admin.test@terrimap.vn' LIMIT 1) LIMIT 1;",
  "  IF v_project_id IS NULL THEN",
  "    RAISE EXCEPTION 'Could not find a test project (id=test-project-terrimap, or owned by admin.test@terrimap.vn). Please create/login the test project first.';",
  "  END IF;",
  '',
  '  -- Get the Hanoi region ID dynamically based on name and project_id',
  "  -- Prefer stable test region id if it exists, otherwise fallback to name match.",
  "  SELECT id INTO v_region_hn FROM public.regions WHERE id = 'test-region-hn' AND project_id = v_project_id LIMIT 1;",
  "  IF v_region_hn IS NULL THEN",
  "    SELECT id INTO v_region_hn FROM public.regions WHERE project_id = v_project_id AND name IN ('Hà Nội','Ha Noi','Hanoi') LIMIT 1;",
  "  END IF;",
  '  IF v_region_hn IS NULL THEN',
  "    RAISE EXCEPTION 'Could not find Hanoi region for the current project.';",
  '  END IF;',
  '',
  "  -- Get the default sales test user ID if exists",
  "  SELECT id INTO v_sales_id FROM auth.users WHERE email = 'sales.test@terrimap.vn' LIMIT 1;",
  '  IF v_sales_id IS NULL THEN',
  "    -- Create the default sales test user if it doesn't exist",
  "    v_sales_id := gen_random_uuid();",
  '    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)',
  `    VALUES (v_sales_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales.test@terrimap.vn', crypt('Test@2025!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW());`,
  '    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)',
  `    VALUES (v_sales_id, v_sales_id, format('{"sub": "%s", "email": "%s"}', v_sales_id, 'sales.test@terrimap.vn')::jsonb, 'email', v_sales_id, NOW(), NOW(), NOW());`,
  '  END IF;',
  '',
  '  RAISE NOTICE \'Targeting project ID: %\', v_project_id;',
  '  RAISE NOTICE \'Targeting region ID: %\', v_region_hn;',
  '',
  '  -- Clean old Hanoi data',
  "  DELETE FROM public.assignments WHERE zone_id LIKE 'hn_%';",
  "  DELETE FROM public.activities WHERE zone_id LIKE 'hn_%';",
  "  DELETE FROM public.zones WHERE id LIKE 'hn_%' OR region_id = v_region_hn;",
  "  DELETE FROM public.project_members WHERE (user_id IN (SELECT id FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn') OR user_id = v_sales_id) AND project_id = v_project_id;",
  "  DELETE FROM public.sales_agents WHERE id LIKE 'sales_hn_%' OR id IN (SELECT id::text FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn') OR id = v_sales_id::text OR region_id = v_region_hn;",
  "  DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn') OR id = v_sales_id;",
  "  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn');",
  "  DELETE FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn';",
  ''
)

// 1. Insert auth.users for sales_hn_1 to sales_hn_19
sqlLines.push('  -- Insert auth.users for Hanoi sales agents')
sqlLines.push('  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES')
const userLines: string[] = []
for (let i = 1; i <= 19; i++) {
  userLines.push(`    (v_sales_hn_${i}_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales_hn_${i}@terrimap.vn', crypt('Test@2025!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())`)
}
sqlLines.push(userLines.join(',\n') + ';')
sqlLines.push('')

// 2. Insert auth.identities for sales_hn_1 to sales_hn_19
sqlLines.push('  -- Insert auth.identities for Hanoi sales agents')
sqlLines.push('  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES')
const identityLines: string[] = []
for (let i = 1; i <= 19; i++) {
  identityLines.push(`    (v_sales_hn_${i}_id, v_sales_hn_${i}_id, format('{"sub": "%s", "email": "%s"}', v_sales_hn_${i}_id, 'sales_hn_${i}@terrimap.vn')::jsonb, 'email', v_sales_hn_${i}_id, NOW(), NOW(), NOW())`)
}
sqlLines.push(identityLines.join(',\n') + ';')
sqlLines.push('')

// 3. Insert profiles
sqlLines.push('  -- Insert profiles')
sqlLines.push('  INSERT INTO public.profiles (id, email, full_name) VALUES')
const profileLines: string[] = []
profileLines.push(`    (v_sales_id, 'sales.test@terrimap.vn', 'Nhan Vien Test (Admin/Sales)')`)
for (let i = 1; i <= 19; i++) {
  profileLines.push(`    (v_sales_hn_${i}_id, 'sales_hn_${i}@terrimap.vn', 'Nhan Vien HN-${i}')`)
}
sqlLines.push(profileLines.join(',\n') + '\n  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;')
sqlLines.push('')

// 4. Insert project_members
sqlLines.push('  -- Insert project_members')
sqlLines.push('  INSERT INTO public.project_members (project_id, user_id, role, region_id) VALUES')
const memberLines: string[] = []
memberLines.push(`    (v_project_id, v_sales_id, 'sales', v_region_hn)`)
for (let i = 1; i <= 19; i++) {
  memberLines.push(`    (v_project_id, v_sales_hn_${i}_id, 'sales', v_region_hn)`)
}
sqlLines.push(memberLines.join(',\n') + '\n  ON CONFLICT (project_id, user_id) DO NOTHING;')
sqlLines.push('')

// 5. Insert sales_agents
sqlLines.push('  -- Insert sales_agents')
sqlLines.push('  INSERT INTO public.sales_agents (id, name, active_region, capacity, region_id, project_id) VALUES')
const salesAgentLines: string[] = []
salesAgentLines.push(`    (v_sales_id::text, 'Nhan Vien Test (Admin/Sales)', 'Ha Noi', 450, v_region_hn, v_project_id)`)
for (let i = 1; i <= 19; i++) {
  const capacity = 350 + (i * 15) % 300
  salesAgentLines.push(`    (v_sales_hn_${i}_id::text, 'Nhan Vien HN-${i}', 'Ha Noi', ${capacity}, v_region_hn, v_project_id)`)
}
sqlLines.push(salesAgentLines.join(',\n') + '\n  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active_region = EXCLUDED.active_region, capacity = EXCLUDED.capacity, region_id = EXCLUDED.region_id, project_id = EXCLUDED.project_id;')
sqlLines.push('')

// 6. Generate 500 Hanoi Zones
sqlLines.push('  -- Insert 500 zones in Hanoi')
sqlLines.push('  INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id) VALUES')
const zoneLines: string[] = []

// 7. Generate Activities
const actLines: string[] = []

// 8. Generate Assignments
const assLines: string[] = []

// -----------------------------------------------------------------------------
// Build an irregular tessellation (no gaps/overlaps) with shared boundaries.
// This replaces the old uniform-rectangle dataset.
// -----------------------------------------------------------------------------
const rand = mulberry32(20260527)
const xCuts = buildCuts(lngMin, lngMax, COLS, rand)
const yCuts = buildCuts(latMin, latMax, ROWS, rand)

// Shared boundary segments (internal lines only). Outer borders stay straight.
const vSeg: Pt[][][] = Array.from({ length: COLS + 1 }, () => Array.from({ length: ROWS }, () => []))
const hSeg: Pt[][][] = Array.from({ length: COLS }, () => Array.from({ length: ROWS + 1 }, () => []))

for (let c = 1; c < COLS; c++) {
  for (let r = 0; r < ROWS; r++) {
    const x = xCuts[c]!
    const y0 = yCuts[r]!
    const y1 = yCuts[r + 1]!
    const wLeft = x - xCuts[c - 1]!
    const wRight = xCuts[c + 1]! - x
    const amp = clamp(Math.min(wLeft, wRight) * 0.22, 0, 0.00035)
    vSeg[c]![r] = makeVerticalSegment(x, y0, y1, amp, rand)
  }
}

for (let c = 0; c < COLS; c++) {
  for (let r = 1; r < ROWS; r++) {
    const y = yCuts[r]!
    const x0 = xCuts[c]!
    const x1 = xCuts[c + 1]!
    const hBot = y - yCuts[r - 1]!
    const hTop = yCuts[r + 1]! - y
    const amp = clamp(Math.min(hBot, hTop) * 0.22, 0, 0.00035)
    hSeg[c]![r] = makeHorizontalSegment(y, x0, x1, amp, rand)
  }
}

for (let col = 0; col < COLS; col++) {
  for (let row = 0; row < ROWS; row++) {
    const id = `hn_${col.toString().padStart(2, '0')}_${row.toString().padStart(2, '0')}`
    const name = `Vung HN-${col + 1}-${row + 1}`

    const x0 = xCuts[col]!
    const x1 = xCuts[col + 1]!
    const y0 = yCuts[row]!
    const y1 = yCuts[row + 1]!

    const bottom = row === 0 ? ([[x0, y0], [x1, y0]] as Pt[]) : hSeg[col]![row]!
    const right = col === COLS - 1 ? ([[x1, y0], [x1, y1]] as Pt[]) : vSeg[col + 1]![row]!
    const top = row === ROWS - 1 ? ([[x1, y1], [x0, y1]] as Pt[]) : [...hSeg[col]![row + 1]!].reverse()
    const left = col === 0 ? ([[x0, y1], [x0, y0]] as Pt[]) : [...vSeg[col]![row]!].reverse()

    const ring = stitch([bottom, right, top, left])

    const polygon = { type: 'Polygon', coordinates: [ring] }
    const c = centroidOfRing(ring)

    zoneLines.push(`    ('${id}', '${name}', 'unassigned', '${JSON.stringify(polygon)}'::jsonb, '${JSON.stringify(c)}'::jsonb, v_region_hn, v_project_id)`)

    const customers = Math.floor((Math.sin(col / 2.0) + Math.cos(row / 2.0) + 2) * 50) + 20
    const orders = Math.floor(customers * 0.7)
    
    actLines.push(`    ('${id}-c', '${id}', 'CUSTOMER', ${customers})`)
    actLines.push(`    ('${id}-o', '${id}', 'ORDER', ${orders})`)

    const districtId = Math.floor(col / 5) + Math.floor(row / 5) * 5
    const salesAgentIdVar = districtId === 0 ? 'v_sales_id::text' : `v_sales_hn_${districtId}_id::text`
    assLines.push(`    ('${id}', ${districtId}, ${salesAgentIdVar})`)
  }
}

sqlLines.push(zoneLines.join(',\n') + ';')
sqlLines.push('')

sqlLines.push('  -- Insert activities')
sqlLines.push('  INSERT INTO public.activities (id, zone_id, type, value) VALUES')
sqlLines.push(actLines.join(',\n') + ';')
sqlLines.push('')

sqlLines.push('  -- Insert assignments')
sqlLines.push('  INSERT INTO public.assignments (zone_id, district_id, sales_agent_id) VALUES')
sqlLines.push(assLines.join(',\n') + ';')
sqlLines.push('')

sqlLines.push('END $$;')

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../docs/seed-large.sql')
writeFileSync(outPath, sqlLines.join('\n'), 'utf-8')
console.log(`✅ seed-large.sql generated at ${outPath}`)
