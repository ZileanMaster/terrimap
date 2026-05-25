import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const COLS = 25
const ROWS = 20

const lngMin = 105.810
const lngMax = 105.860
const latMin = 21.000
const latMax = 21.048

const colWidth = (lngMax - lngMin) / COLS // 0.002
const rowHeight = (latMax - latMin) / ROWS // 0.0024

function centroidOf(left: number, bottom: number, right: number, top: number) {
  const lat = (bottom + top) / 2
  const lng = (left + right) / 2
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 }
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
  '  v_project_id UUID;',
  '  v_region_hn TEXT;',
  '  v_sales_id UUID;',
]

// Declare 19 variables for UUIDs
for (let i = 1; i <= 19; i++) {
  sqlLines.push(`  v_sales_hn_${i}_id UUID := gen_random_uuid();`)
}

sqlLines.push(
  'BEGIN',
  '  -- Get the first project ID as target',
  '  SELECT id INTO v_project_id FROM public.projects LIMIT 1;',
  '  IF v_project_id IS NULL THEN',
  "    RAISE EXCEPTION 'Không tìm thấy project nào trong database. Vui lòng đăng nhập và tạo project trước!';",
  '  END IF;',
  '',
  '  -- Get the Hanoi region ID dynamically based on name and project_id',
  "  SELECT id INTO v_region_hn FROM public.regions WHERE name = 'Hà Nội' AND project_id = v_project_id LIMIT 1;",
  '  IF v_region_hn IS NULL THEN',
  "    RAISE EXCEPTION 'Không tìm thấy khu vực Hà Nội cho project hiện tại!';",
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
  "  DELETE FROM public.sales_agents WHERE id LIKE 'sales_hn_%' OR id IN (SELECT id FROM auth.users WHERE email LIKE 'sales_hn_%@terrimap.vn') OR id = v_sales_id OR region_id = v_region_hn;",
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
profileLines.push(`    (v_sales_id, 'sales.test@terrimap.vn', 'Nhân Viên Test (Admin/Sales)')`)
for (let i = 1; i <= 19; i++) {
  profileLines.push(`    (v_sales_hn_${i}_id, 'sales_hn_${i}@terrimap.vn', 'Nhân Viên HN-${i}')`)
}
sqlLines.push(profileLines.join(',\n') + ';')
sqlLines.push('')

// 4. Insert project_members
sqlLines.push('  -- Insert project_members')
sqlLines.push('  INSERT INTO public.project_members (project_id, user_id, role, region_id) VALUES')
const memberLines: string[] = []
memberLines.push(`    (v_project_id, v_sales_id, 'sales', v_region_hn)`)
for (let i = 1; i <= 19; i++) {
  memberLines.push(`    (v_project_id, v_sales_hn_${i}_id, 'sales', v_region_hn)`)
}
sqlLines.push(memberLines.join(',\n') + ';')
sqlLines.push('')

// 5. Insert sales_agents
sqlLines.push('  -- Insert sales_agents')
sqlLines.push('  INSERT INTO public.sales_agents (id, name, active_region, capacity, region_id, project_id) VALUES')
const salesAgentLines: string[] = []
salesAgentLines.push(`    (v_sales_id, 'Nhân Viên Test (Admin/Sales)', 'Hà Nội', 450, v_region_hn, v_project_id)`)
for (let i = 1; i <= 19; i++) {
  const capacity = 350 + (i * 15) % 300
  salesAgentLines.push(`    (v_sales_hn_${i}_id, 'Nhân Viên HN-${i}', 'Hà Nội', ${capacity}, v_region_hn, v_project_id)`)
}
sqlLines.push(salesAgentLines.join(',\n') + ';')
sqlLines.push('')

// 6. Generate 500 Hanoi Zones
sqlLines.push('  -- Insert 500 zones in Hanoi')
sqlLines.push('  INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id) VALUES')
const zoneLines: string[] = []

// 7. Generate Activities
const actLines: string[] = []

// 8. Generate Assignments
const assLines: string[] = []

for (let col = 0; col < COLS; col++) {
  for (let row = 0; row < ROWS; row++) {
    const id = `hn_${col.toString().padStart(2, '0')}_${row.toString().padStart(2, '0')}`
    const name = `Vùng HN-${col + 1}-${row + 1}`
    
    const left = lngMin + col * colWidth
    const right = left + colWidth
    const bottom = latMin + row * rowHeight
    const top = bottom + rowHeight
    
    const polygon = {
      type: 'Polygon',
      coordinates: [[
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
        [left, bottom]
      ]]
    }
    const c = centroidOf(left, bottom, right, top)
    
    zoneLines.push(`    ('${id}', '${name}', 'unassigned', '${JSON.stringify(polygon)}'::jsonb, '${JSON.stringify(c)}'::jsonb, v_region_hn, v_project_id)`)

    const customers = Math.floor((Math.sin(col / 2.0) + Math.cos(row / 2.0) + 2) * 50) + 20
    const orders = Math.floor(customers * 0.7)
    
    actLines.push(`    ('${id}-c', '${id}', 'CUSTOMER', ${customers})`)
    actLines.push(`    ('${id}-o', '${id}', 'ORDER', ${orders})`)

    const districtId = (col % 5) + (row % 4) * 5
    const salesAgentIdVar = districtId === 0 ? 'v_sales_id' : `v_sales_hn_${districtId}_id`
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
