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
  'DO $$',
  'DECLARE',
  '  v_project_id UUID;',
  '  v_region_hn TEXT;',
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
  '  RAISE NOTICE \'Targeting project ID: %\', v_project_id;',
  '  RAISE NOTICE \'Targeting region ID: %\', v_region_hn;',
  '',
  '  -- Clean old Hanoi data',
  "  DELETE FROM public.assignments WHERE zone_id LIKE 'hn_%';",
  "  DELETE FROM public.activities WHERE zone_id LIKE 'hn_%';",
  "  DELETE FROM public.zones WHERE id LIKE 'hn_%' OR region_id = v_region_hn;",
  "  DELETE FROM public.sales_agents WHERE id LIKE 'sales_hn_%' OR region_id = v_region_hn;",
  '',
]

// 1. Generate 20 Hanoi Sales Agents
sqlLines.push('  -- Insert 20 sales agents in Hanoi')
sqlLines.push('  INSERT INTO public.sales_agents (id, name, active_region, capacity, region_id, project_id) VALUES')
const agentLines: string[] = []

// Add sales.test@terrimap.vn first (default logged in user)
agentLines.push(`    ('sales.test@terrimap.vn', 'Nhân Viên Test (Admin/Sales)', 'Hà Nội', 450, v_region_hn, v_project_id)`)

for (let i = 1; i <= 19; i++) {
  const capacity = 350 + (i * 15) % 300
  agentLines.push(`    ('sales_hn_${i}@terrimap.vn', 'Nhân Viên HN-${i}', 'Hà Nội', ${capacity}, v_region_hn, v_project_id)`)
}
sqlLines.push(agentLines.join(',\n') + ';')
sqlLines.push('')

// 2. Generate 500 Hanoi Zones
sqlLines.push('  -- Insert 500 zones in Hanoi')
sqlLines.push('  INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id) VALUES')
const zoneLines: string[] = []

// 3. Generate Activities
const actLines: string[] = []

// 4. Generate Assignments
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
    const salesAgentId = districtId === 0 ? 'sales.test@terrimap.vn' : `sales_hn_${districtId}@terrimap.vn`
    assLines.push(`    ('${id}', ${districtId}, '${salesAgentId}')`)
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
