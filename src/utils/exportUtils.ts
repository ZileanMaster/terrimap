/**
 * Tiện ích export — CSV, GeoJSON, PDF (in)
 * Hàm thuần, không phụ thuộc React.
 * Dùng Blob + URL.createObjectURL gốc của trình duyệt để tải xuống.
 */

import type { Zone, Assignment, AdjMatrix, ReportData } from '../../facades/viewmodels.js'

// ── Escape HTML (chống XSS cho printReport) ─────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default:  return c
    }
  })
}

// ?? Tr? l? t?i xu?ng ???????????????????????????????????????????????????????????

/**
 * K?ch ho?t t?i xu?ng file t? n?i dung chu?i.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Activity helpers ───────────────────────────────────────────────────────────

function getCustomers(z: Zone): number {
  return z.activities.filter(a => a.type === 'CUSTOMER').reduce((s, a) => s + a.value, 0)
}

function getOrders(z: Zone): number {
  return z.activities.filter(a => a.type === 'ORDER').reduce((s, a) => s + a.value, 0)
}

/** Escape CSV field — wrap in quotes if contains comma, quote, or newline */
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

// ── CSV Exports ────────────────────────────────────────────────────────────────

/**
 * Xu?t assignments ra CSV.
 * C?t: zoneId, zoneName, districtId, salesAgentId, customers, orders
 */
export function exportAssignmentsCSV(zones: Zone[], assignments: Assignment[]): void {
  const zoneMap = new Map(zones.map(z => [z.id, z]))
  const header = 'zoneId,zoneName,districtId,salesAgentId,customers,orders'
  const rows = assignments.map(a => {
    const z = zoneMap.get(a.zoneId)
    const customers = z ? getCustomers(z) : 0
    const orders = z ? getOrders(z) : 0
    const name = csvEscape(z?.name ?? '')
    return `${a.zoneId},${name},${a.districtId},${a.salesAgentId},${customers},${orders}`
  })
  downloadFile([header, ...rows].join('\n'), 'assignments.csv', 'text/csv;charset=utf-8')
}

/**
 * Xu?t metadata c?a zones ra CSV.
 * C?t: zoneId, zoneName, status, centroidLat, centroidLng, customers, orders, polygonPointCount
 */
export function exportZonesCSV(zones: Zone[]): void {
  const header = 'zoneId,zoneName,status,centroidLat,centroidLng,customers,orders,polygonPointCount'
  const rows = zones.map(z => {
    const customers = getCustomers(z)
    const orders = getOrders(z)
    const pointCount = z.polygon.type === 'Polygon'
      ? z.polygon.coordinates[0]?.length ?? 0
      : z.polygon.coordinates.reduce((s, p) => s + (p[0]?.length ?? 0), 0)
    const name = csvEscape(z.name)
    return `${z.id},${name},${z.status},${z.centroid.lat},${z.centroid.lng},${customers},${orders},${pointCount}`
  })
  downloadFile([header, ...rows].join('\n'), 'zones.csv', 'text/csv;charset=utf-8')
}

/**
 * Xu?t ma tr?n k? ra CSV.
 * C?t: zoneId, neighbors (ng?n c?ch b?ng d?u ph?y v? ??t trong d?u ngo?c k?p)
 */
export function exportMatrixCSV(adj: AdjMatrix): void {
  const header = 'zoneId,neighbors'
  const rows = Object.entries(adj).map(([id, neighbors]) =>
    `${id},"${neighbors.join(',')}"`,
  )
  downloadFile([header, ...rows].join('\n'), 'matrix.csv', 'text/csv;charset=utf-8')
}

// ── GeoJSON Export ─────────────────────────────────────────────────────────────

/**
 * Xu?t zones + assignments th?nh GeoJSON FeatureCollection.
 * Vùng coordinates kept in [lng, lat] (GeoJSON spec).
 */
export function exportGeoJSON(zones: Zone[], assignments: Assignment[]): void {
  const assignMap = new Map(assignments.map(a => [a.zoneId, a]))

  const features = zones.map(z => {
    const a = assignMap.get(z.id)
    return {
      type: 'Feature' as const,
      geometry: z.polygon,
      properties: {
        zoneId: z.id,
        zoneName: z.name,
        status: z.status,
        districtId: a?.districtId ?? -1,
        salesAgentId: a?.salesAgentId ?? '',
        customers: getCustomers(z),
        orders: getOrders(z),
      },
    }
  })

  const fc = { type: 'FeatureCollection' as const, features }
  const json = JSON.stringify(fc, null, 2)
  downloadFile(json, 'territory.geojson', 'application/geo+json;charset=utf-8')
}

// ── Print Report (PDF via window.print) ────────────────────────────────────────

/**
 * M? c?a s? th?n thi?n ?? in v?i d? li?u b?o c?o.
 * Uses window.open + window.print — no external PDF library needed.
 */
export function printReport(
  report: ReportData,
  result?: { balanceScore: number; maxDiameter: number; violationCount: number; algo: string } | null,
): void {
  const dateStr = new Date(report.generatedAt).toLocaleString('vi-VN')
  const dateShort = new Date(report.generatedAt).toLocaleDateString('vi-VN')

  // T?o c?c d?ng assignment
  const assignRows = report.assignments.map(a => {
    const z = report.zones.find(zone => zone.id === a.zoneId)
    const cust = z ? getCustomers(z) : 0
    const ord = z ? getOrders(z) : 0
    return `<tr><td>${escapeHtml(z?.name ?? a.zoneId)}</td><td>D${a.districtId}</td><td>${escapeHtml(a.salesAgentId ?? '')}</td><td>${cust}</td><td>${ord}</td></tr>`
  }).join('')

  const algoSection = result ? `
  <h2>Kết quả thuật toán (${escapeHtml(result.algo.toUpperCase())})</h2>
  <table>
    <tr><th>Metric</th><th>Giá trị</th></tr>
    <tr><td>Balance Score</td><td>${result.balanceScore.toFixed(1)}</td></tr>
    <tr><td>Max Diameter</td><td>${result.maxDiameter.toFixed(1)} km</td></tr>
    <tr><td>Violations</td><td>${result.violationCount}</td></tr>
  </table>` : ''

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Territory Report — ${dateShort}</title>
  <style>
    body { font-family: 'Roboto', 'Segoe UI', -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
    h1 { font-size: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 24px; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .metrics { display: flex; gap: 32px; flex-wrap: wrap; margin: 16px 0; }
    .metric { text-align: center; }
    .metric-value { font-size: 28px; font-weight: 800; color: #2563eb; }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-top: 2px; }
    .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>📊 Territory Report</h1>
  <p>Ngày tạo: ${dateStr}</p>

  <h2>Tổng quan</h2>
  <div class="metrics">
    <div class="metric"><div class="metric-value">${report.totalZones}</div><div class="metric-label">Vùng</div></div>
    <div class="metric"><div class="metric-value">${report.totalDistricts}</div><div class="metric-label">Districts</div></div>
    <div class="metric"><div class="metric-value">${report.totalSales}</div><div class="metric-label">Sales</div></div>
    <div class="metric"><div class="metric-value">${report.totalCustomers}</div><div class="metric-label">Khách hàng</div></div>
    <div class="metric"><div class="metric-value">${report.totalOrders}</div><div class="metric-label">Đơn hàng</div></div>
  </div>

  ${algoSection}

  <h2>Danh sách phân vùng</h2>
  <table>
    <tr><th>Vùng</th><th>District</th><th>Sales</th><th>KH</th><th>Đơn</th></tr>
    ${assignRows}
  </table>

</body>
</html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }
}
