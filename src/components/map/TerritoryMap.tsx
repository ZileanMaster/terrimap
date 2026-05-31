/**
 * TerritoryMap — Leaflet map với zones + assignments coloring
 *
 * L4b-1: highlightedSalesId + isTransitioning
 * L4b-2: islandZoneIds (dashed orange border) + disconnectedDistrictIds (dashed red border)
 *
 * Priority chain: disconnected(red) > island(orange) > highlighted > selected > normal
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Zone, Assignment, GeoJSONPolygon } from '../../../facades/viewmodels.js'

import {
  getDistrictFillColor,
  DISTRICT_FILL_OPACITY,
  DISTRICT_FILL_OPACITY_SELECTED,
  DISTRICT_WEIGHT,
  DISTRICT_WEIGHT_SELECTED,
} from '../../data/district-colors.js'
import { useUIStore } from '../../store/uiStore.js'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

/** Dimmed opacity when another sales agent is highlighted */
const DISTRICT_FILL_OPACITY_DIMMED = 0.10
/** Transition flash opacity */
const DISTRICT_FILL_OPACITY_TRANSITION = 0.05

export interface TerritoryMapProps {
  zones:              Zone[]
  assignments:        Assignment[]
  onZoneClick?:       (zoneId: string) => void
  selectedZoneId?:    string | null
  highlightedSalesId?: string | null   // L4b-1
  isTransitioning?:   boolean          // L4b-1
  center?:            [number, number]
  zoom?:              number
  children?:          React.ReactNode
  islandZoneIds?:           Set<string>   // L4b-2 EC-1
  disconnectedDistrictIds?: Set<number>   // L4b-2 EC-2
  /** Show a single top-right button that lets the user draw a polygon by clicking points on the map. */
  canDrawPolygon?: boolean
  /** Called when the user finishes drawing a polygon via click-to-add-points mode. */
  onPolygonDrawn?: (polygon: GeoJSONPolygon, centroid: { lat: number; lng: number }) => void
}

// ── Leaflet position fix ───────────────────────────────────────────────────────
import L from 'leaflet'
// @ts-expect-error _getIconUrl
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9/dist/images/marker-shadow.png',
})

// ── MapFlyTo — smooth animation when region changes ───────────────────────────
function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  const prevCenter = React.useRef(center)
  const prevZoom = React.useRef(zoom)

  React.useEffect(() => {
    const centerChanged =
      prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1]
    const zoomChanged = prevZoom.current !== zoom

    if (centerChanged || zoomChanged) {
      map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 })
      prevCenter.current = center
      prevZoom.current = zoom
    }
  }, [map, center, zoom])

  return null
}

// ── MapZoneFlyTo — fitBounds to selected zone polygon ─────────────────────────
// Accurate zoom-to-zone using Leaflet bounds (avoids centroid storage issues)
function MapZoneFlyTo({ zones, selectedZoneId }: { zones: Zone[]; selectedZoneId?: string | null }) {
  const map = useMap()
  const prevZoneId = React.useRef<string | null | undefined>(null)

  React.useEffect(() => {
    if (!selectedZoneId || selectedZoneId === prevZoneId.current) return
    prevZoneId.current = selectedZoneId

    const zone = zones.find((z) => z.id === selectedZoneId)
    if (!zone) return

    // Build [lat, lng][] from GeoJSON [lng, lat][] for Leaflet
    let ring: number[][] = []
    if (zone.polygon.type === 'Polygon') {
      ring = (zone.polygon.coordinates[0] ?? []) as number[][]
    } else if (zone.polygon.type === 'MultiPolygon') {
      ring = ((zone.polygon.coordinates[0]?.[0]) ?? []) as number[][]
    }
    if (ring.length < 2) return

    // Convert GeoJSON [lng, lat] → Leaflet [lat, lng]
    const latlngs: [number, number][] = ring.map(([lng, lat]) => [lat!, lng!])
    try {
      const bounds = L.latLngBounds(latlngs)
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.0, maxZoom: 16 })
      }
    } catch {
      // Ignore invalid bounds
    }
  }, [map, zones, selectedZoneId])

  return null
}

export default function TerritoryMap({
  zones,
  assignments,
  onZoneClick,
  selectedZoneId,
  highlightedSalesId = null,
  isTransitioning = false,
  center = [21.03, 105.83],
  zoom = 12,
  children,
  islandZoneIds,
  disconnectedDistrictIds,
  canDrawPolygon = false,
  onPolygonDrawn,
}: TerritoryMapProps) {
  // Note: uiStore is mocked in some unit tests with partial state, so keep defaults here.
  const selectedDistrictId = useUIStore((s: any) => (s?.selectedDistrictId ?? null) as number | null)
  const showPolygons = useUIStore((s: any) => (s?.showPolygons ?? true) as boolean)
  const hiddenZoneIds = useUIStore((s: any) => (s?.hiddenZoneIds ?? {}) as Record<string, true>)

  // Build colorMap: zoneId → districtId
  const colorMap = useMemo(
    () => new Map(assignments.map((a) => [a.zoneId, a.districtId])),
    [assignments],
  )

  // Build salesMap: zoneId → salesAgentId
  const salesMap = useMemo(
    () => new Map(assignments.map((a) => [a.zoneId, a.salesAgentId])),
    [assignments],
  )

  // Build customers lookup
  const customersMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const z of zones) {
      const count = z.activities
        .filter((a) => a.type === 'CUSTOMER')
        .reduce((s, a) => s + a.value, 0)
      m.set(z.id, count)
    }
    return m
  }, [zones])

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]) // [lat,lng]

  const resetDrawing = useCallback(() => {
    setIsDrawing(false)
    setDrawPoints([])
  }, [])

  const finishDrawing = useCallback(() => {
    if (!onPolygonDrawn) {
      resetDrawing()
      return
    }
    if (drawPoints.length < 3) {
      alert('Cần ít nhất 3 điểm để tạo polygon.')
      return
    }

    const ring: [number, number][] = drawPoints.map(([lat, lng]) => [lng, lat])
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]])

    const centroid = {
      lat: drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      lng: drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    }
    const polygon: GeoJSONPolygon = { type: 'Polygon', coordinates: [ring] }
    onPolygonDrawn(polygon, centroid)
    resetDrawing()
  }, [drawPoints, onPolygonDrawn, resetDrawing])

  // Keyboard shortcuts while drawing:
  // - Esc: cancel
  // - Backspace: undo last point
  useEffect(() => {
    if (!isDrawing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        resetDrawing()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setDrawPoints((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawing, resetDrawing])

  function DrawPointCatcher({ enabled }: { enabled: boolean }) {
    useMapEvents({
      click: (e) => {
        if (!enabled) return
        const t = e.originalEvent?.target as HTMLElement | undefined
        if (t && (t.closest?.('[data-tm-overlay]') || t.closest?.('[data-snapshot-manager]'))) return
        setDrawPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]])
      },
    })
    return null
  }

  return (
    <div style={styles.wrapper} data-testid="territory-map">
      {canDrawPolygon && (
        <div style={styles.drawOverlay} data-tm-overlay>
          <button
            type="button"
            style={styles.drawBtn}
            onClick={() => {
              if (!isDrawing) {
                setIsDrawing(true)
                setDrawPoints([])
                return
              }
              finishDrawing()
            }}
            title={isDrawing ? 'Kết thúc vẽ polygon' : 'Vẽ polygon (chấm các điểm trên bản đồ)'}
          >
            {isDrawing ? 'Kết thúc vẽ' : 'Vẽ polygon'}
          </button>
          {isDrawing && (
            <button
              type="button"
              style={styles.drawBtnGhost}
              onClick={resetDrawing}
              title="Hủy vẽ (Esc)"
            >
              Hủy
            </button>
          )}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        style={styles.map}
        zoomControl
      >
        {/* Smooth fly-to when region changes */}
        <MapFlyTo center={center} zoom={zoom} />
        {/* Accurate zoom-to-zone when zone is selected */}
        <MapZoneFlyTo zones={zones} selectedZoneId={selectedZoneId} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          className="map-tiles"
        />

        <DrawPointCatcher enabled={Boolean(canDrawPolygon && onPolygonDrawn && isDrawing)} />

        {isDrawing && drawPoints.length > 0 && (
          <>
            <Polyline positions={drawPoints} pathOptions={{ color: '#2563eb', weight: 2, opacity: 0.9 }} />
            {drawPoints.map((p, idx) => (
              <CircleMarker
                key={idx}
                center={p}
                radius={4}
                pathOptions={{ color: '#1d4ed8', weight: 2, fillColor: '#60a5fa', fillOpacity: 1 }}
              />
            ))}
          </>
        )}

        {isDrawing && drawPoints.length >= 3 && (
          <Polygon
            positions={[drawPoints]}
            pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#60a5fa', fillOpacity: 0.08, dashArray: '4 3' }}
          />
        )}

        {showPolygons && zones
          .filter((z) => !hiddenZoneIds[z.id])
          .map((zone) => {
          const districtId  = colorMap.get(zone.id)   // undefined if unassigned
          const salesId     = salesMap.get(zone.id)
          const isAssigned  = districtId !== undefined
          const isSelected  = zone.id === selectedZoneId
          const color       = isAssigned
            ? getDistrictFillColor(districtId!)
            : '#9ca3af'  // gray-400 for unassigned zones
          const customers   = customersMap.get(zone.id) ?? 0

          // L4b-2: Edge case flags
          const isIsland       = islandZoneIds?.has(zone.id) ?? false
          const isDisconnected = isAssigned && (disconnectedDistrictIds?.has(districtId!) ?? false)

          // Legend focus: dim everything except the selected district
          const isLegendFocused = selectedDistrictId != null
          const isFocusedDistrict = isLegendFocused && districtId === selectedDistrictId
          const shouldDimForLegend = isLegendFocused && !isFocusedDistrict

          // L4b-1: Sales highlight logic
          const isHighlightedSales = highlightedSalesId != null
            ? salesId === highlightedSalesId
            : null

          // Compute fill opacity — priority: transition > sales highlight > zone selection > default
          let fillOpacity: number
          if (isTransitioning) {
            fillOpacity = DISTRICT_FILL_OPACITY_TRANSITION
          } else if (isHighlightedSales === true) {
            fillOpacity = DISTRICT_FILL_OPACITY_SELECTED
          } else if (isHighlightedSales === false) {
            fillOpacity = DISTRICT_FILL_OPACITY_DIMMED
          } else if (isSelected) {
            fillOpacity = DISTRICT_FILL_OPACITY_SELECTED
          } else {
            fillOpacity = DISTRICT_FILL_OPACITY
          }

          if (shouldDimForLegend) {
            fillOpacity = Math.min(fillOpacity, 0.06)
          } else if (isFocusedDistrict) {
            fillOpacity = Math.max(fillOpacity, 0.28)
          }

          // Weight: thicker for selected or highlighted-agent zones
          const baseWeight =
            isSelected || isHighlightedSales === true
              ? DISTRICT_WEIGHT_SELECTED
              : DISTRICT_WEIGHT

          // L4b-2: Border priority — disconnected (red, 3) > island (orange, 2.5) > unassigned (gray dashed) > normal
          let borderColor  = color
          let borderWeight = baseWeight
          let dashArray: string | undefined = undefined

          if (!isAssigned) {
            // Unassigned zones: gray dashed outline, very light fill
            borderColor  = '#6b7280'
            borderWeight = 1.5
            dashArray    = '5 5'
          }

          if (isDisconnected) {
            borderColor  = '#dc2626'
            borderWeight = 3
            dashArray    = '6 3'
          } else if (isIsland) {
            borderColor  = '#f59e0b'
            borderWeight = 2.5
            dashArray    = '8 4'
          }

          // Convert GeoJSON [lng, lat][] → Leaflet [lat, lng][]
          let positions: [number, number][][]

          if (zone.polygon.type === 'Polygon') {
            positions = zone.polygon.coordinates.map((ring) =>
              ring.map(([lng, lat]) => [lat, lng] as [number, number]),
            )
          } else {
            // MultiPolygon — pick first polygon for now
            positions = (zone.polygon.coordinates[0] ?? []).map((ring) =>
              ring.map(([lng, lat]) => [lat, lng] as [number, number]),
            )
          }

          return (
            <Polygon
              key={zone.id}
              positions={positions}
              // Extra data-* props: ignored by Leaflet in browser, picked up by mock in jsdom
              {...({
                'data-zone-id':  zone.id,
                'data-district': districtId,
                'data-selected': String(isSelected),
              } as object)}
              pathOptions={{
                color:       borderColor,
                fillColor:   color,
                fillOpacity: !isAssigned ? 0.12 : fillOpacity,
                weight:      borderWeight,
                dashArray,
                className: isFocusedDistrict ? 'tm-focused-district' : undefined,
                opacity: isTransitioning ? 0.1
                  : !isAssigned ? 0.6
                  : (isSelected || isHighlightedSales === true ? 1 : 0.8),
              }}
              eventHandlers={{
                click: () => onZoneClick?.(zone.id),
              }}
            >
              <Tooltip sticky>
                <div style={{ minWidth: 120 }}>
                  <strong>{zone.name}</strong>
                  <div style={{ fontSize: 11, marginTop: 2, color: '#666' }}>
                    {isAssigned ? `Cụm ${districtId!} · ` : 'Chưa phân vùng · '}{customers} KH
                  </div>
                  {isDisconnected && (
                    <div style={{ fontSize: 11, marginTop: 3, color: '#dc2626', fontWeight: 600 }}>
                      Cụm bị tách rời
                    </div>
                  )}
                  {isIsland && !isDisconnected && (
                    <div style={{ fontSize: 11, marginTop: 3, color: '#f59e0b', fontWeight: 600 }}>
                      ⚠️ Vùng cô lập
                    </div>
                  )}
                  {!isAssigned && (
                    <div style={{ fontSize: 11, marginTop: 3, color: '#6b7280', fontWeight: 600 }}>
                      ⬜ Chưa được phân công
                    </div>
                  )}
                </div>
              </Tooltip>
            </Polygon>
          )
        })}

          {children}
        </MapContainer>

      {/* Dark tile filter injection */}
      <style>{`
        .dark .map-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
        }
        @keyframes tmPulseStroke {
          0%   { stroke-opacity: 1; stroke-width: 2.5; }
          50%  { stroke-opacity: 0.35; stroke-width: 4.0; }
          100% { stroke-opacity: 1; stroke-width: 2.5; }
        }
        .tm-focused-district {
          animation: tmPulseStroke 1.1s ease-in-out infinite;
        }
      `}</style>

      {zones.length === 0 && (
        <div style={styles.emptyOverlay}>
          <span>🗺️ Không có dữ liệu vùng</span>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  drawOverlay: {
    position: 'absolute',
    top: 14,
    right: 10,
    zIndex: 1200,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  drawBtn: {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
  },
  drawBtnGhost: {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    background: 'rgba(255,255,255,0.7)',
    color: 'var(--color-text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
  },
  emptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,.05)',
    fontSize: 16,
    color: 'var(--color-text-3)',
    pointerEvents: 'none',
  },
}
