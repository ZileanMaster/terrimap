/**
 * DrawingToolbar - Điều khiển Leaflet.Draw gốc cho vùng (chỉ admin)
 *
 * Dùng trực tiếp Leaflet Draw (không dùng wrapper react-leaflet-draw) để tránh lỗi ESM.
 * Lưu ý: CSS được import global một lần (xem src/main.tsx) vì dynamic CSS import
 * có thể lỗi trong production build và gây màn hình trắng.
 */

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { GeoJSONPolygon, Zone } from '../../../facades/viewmodels.js'
import { polygonsOverlap } from '../../../lib/geometry.js'

interface DrawingToolbarProps {
  /** Callback when user finishes drawing a vùng. */
  onZoneCreated: (polygon: GeoJSONPolygon, centroid: { lat: number; lng: number }) => void
  /** Callback when user edits an existing zone vùng. */
  onZoneEdited: (zoneId: string, polygon: GeoJSONPolygon, centroid: { lat: number; lng: number }) => void
  /** Existing zones for overlap validation. */
  existingZones?: Zone[]
  /** Selected zone to edit (only one at a time for performance). */
  selectedZone?: Zone | null
}

export default function DrawingToolbar({ onZoneCreated, onZoneEdited, existingZones, selectedZone }: DrawingToolbarProps) {
  const map = useMap()
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const selectedLayerRef = useRef<any>(null)
  const selectedOriginalRingRef = useRef<[number, number][] | null>(null)
  const existingZonesRef = useRef<Zone[] | undefined>(existingZones)

  // Gi? zones m?i nh?t ?? ki?m tra ch?ng l?n m? kh?ng c?n kh?i t?o l?i Leaflet.Draw
  useEffect(() => {
    existingZonesRef.current = existingZones
  }, [existingZones])

  const layerToRing = (layer: any): [number, number][] => {
    const latlngs = (layer.getLatLngs()[0] ?? []) as L.LatLng[]
    const ring: [number, number][] = latlngs.map((ll) => [ll.lng, ll.lat])
    if (ring.length > 0) {
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
    }
    return ring
  }

  const layerCentroid = (layer: any) => {
    const latlngs = (layer.getLatLngs()[0] ?? []) as L.LatLng[]
    const lats = latlngs.map((ll) => ll.lat)
    const lngs = latlngs.map((ll) => ll.lng)
    return {
      lat: lats.reduce((a, b) => a + b, 0) / Math.max(1, lats.length),
      lng: lngs.reduce((a, b) => a + b, 0) / Math.max(1, lngs.length),
    }
  }

  useEffect(() => {
    let cancelled = false
    let drawnItems: L.FeatureGroup | null = null
    let drawControl: any | null = null

    const boot = async () => {
      if (typeof window === 'undefined') return
      if (cancelled) return

      // Leaflet.Draw l? CJS v? c? th? h?i kh? ch?u trong c?c build Vite/ESM.
      // Dynamic import here prevents hard crashes and ensures the side-effect runs before we access L.Control.Draw.
      try {
        await import('leaflet-draw')
      } catch (e) {
        // Kh?ng c? Leaflet.Draw th? toolbar kh?ng th? render; hi?n th? l?i h?u ?ch ?? debug.
        // eslint-disable-next-line no-console
        console.error('[TerriMap] Failed to load leaflet-draw:', e)
        return
      }
      if (cancelled) return

      drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems

      drawControl = new (L.Control as any).Draw({
        // Avoid overlapping the app's top-right map actions ("Lưu map" / "Mở map").
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: { color: '#2563eb', weight: 2, fillOpacity: 0.15 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: false,
          // Leaflet.Draw c?n m?t object ? ??y (n? s? ghi selectedPathOptions v?o ??).
          // Passing boolean true can crash: "Cannot create property 'selectedPathOptions' on boolean 'true'".
          edit: {
            selectedPathOptions: {
              color: '#2563eb',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.08,
            },
          },
        },
      })

      map.addControl(drawControl)

      const onCreated = (e: any) => {
        const layer = e.layer
        const ring = layerToRing(layer)

        const zonesNow = existingZonesRef.current
        if (zonesNow && zonesNow.length > 0) {
          for (const zone of zonesNow) {
            const existingRing =
              zone.polygon.type === 'Polygon' ? zone.polygon.coordinates[0] : zone.polygon.coordinates[0]?.[0]
            if (existingRing && polygonsOverlap(ring, existingRing)) {
              drawnItems?.removeLayer(layer)
              alert(`Vùng mới chồng lắp với vùng "${zone.name}". Vui lòng vẽ lại.`)
              return
            }
          }
        }

        drawnItems?.addLayer(layer)
        const centroid = layerCentroid(layer)
        const polygon: GeoJSONPolygon = { type: 'Polygon', coordinates: [ring] }
        onZoneCreated(polygon, centroid)
      }

      const onEdited = (e: any) => {
        e.layers.eachLayer((layer: any) => {
          const zoneId = layer.__zoneId as string | undefined
          if (!zoneId) return

          const ring = layerToRing(layer)

          const zonesNow = existingZonesRef.current
          if (zonesNow && zonesNow.length > 0) {
            for (const z of zonesNow) {
              if (z.id === zoneId) continue
              const existingRing =
                z.polygon.type === 'Polygon' ? z.polygon.coordinates[0] : z.polygon.coordinates[0]?.[0]
              if (existingRing && polygonsOverlap(ring, existingRing)) {
                if (selectedOriginalRingRef.current) {
                  const latlngs = selectedOriginalRingRef.current.map(([lng, lat]) => [lat, lng] as [number, number])
                  layer.setLatLngs([latlngs])
                }
                alert('Vùng sửa bị chồng lắp vùng khác. Đã hoàn tác.')
                return
              }
            }
          }

          const centroid = layerCentroid(layer)
          const polygon: GeoJSONPolygon = { type: 'Polygon', coordinates: [ring] }
          onZoneEdited(zoneId, polygon, centroid)
          selectedOriginalRingRef.current = ring
        })
      }

      map.on(L.Draw.Event.CREATED, onCreated)
      map.on(L.Draw.Event.EDITED, onEdited)
      ;(drawControl as any).__tm_handlers = { onCreated, onEdited }
    }

    void boot()

    return () => {
      cancelled = true
      if (drawControl && (drawControl as any).__tm_handlers) {
        const { onCreated, onEdited } = (drawControl as any).__tm_handlers
        map.off(L.Draw.Event.CREATED, onCreated)
        map.off(L.Draw.Event.EDITED, onEdited)
      }
      if (drawControl) {
        try {
          map.removeControl(drawControl)
        } catch {
          /* ignore */
        }
      }
      if (drawnItems) {
        try {
          map.removeLayer(drawnItems)
        } catch {
          /* ignore */
        }
      }
      drawnItemsRef.current = null
      selectedLayerRef.current = null
      selectedOriginalRingRef.current = null
    }
  }, [map, onZoneCreated, onZoneEdited])

  // Gi? layer ch?nh s?a zone ?ang ch?n ??ng b? m? kh?ng ph?i t?o l?i to?n b? draw control.
  useEffect(() => {
    const drawnItems = drawnItemsRef.current
    if (!drawnItems) return

    if (selectedLayerRef.current) {
      drawnItems.removeLayer(selectedLayerRef.current)
      selectedLayerRef.current = null
      selectedOriginalRingRef.current = null
    }

    if (!selectedZone) return

    const ring =
      selectedZone.polygon.type === 'Polygon'
        ? selectedZone.polygon.coordinates[0] ?? []
        : selectedZone.polygon.coordinates[0]?.[0] ?? []

    const latlngs = (ring as [number, number][])
      .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map(([lng, lat]) => [lat, lng] as [number, number])

    if (latlngs.length < 3) return

    // QUAN TR?NG: ph?i t??ng t?c ???c ?? c?c tay n?m s?a c?a Leaflet.Draw ho?t ??ng.
    // If interactive is false, the vùng will not receive pointer events and edits feel "non-clickable".
    const layer = L.polygon(latlngs, { color: '#2563eb', weight: 2, fillOpacity: 0.05, interactive: true })
    ;(layer as any).__zoneId = selectedZone.id
    selectedLayerRef.current = layer
    selectedOriginalRingRef.current = layerToRing(layer)
    drawnItems.addLayer(layer)
  }, [selectedZone])

  // Component chỉ dùng hook - không có JSX output
  return null
}
