/**
 * DrawingToolbar - Native Leaflet.Draw polygon control (Admin only)
 *
 * Uses Leaflet Draw directly (not react-leaflet-draw wrapper) to avoid ESM issues.
 * NOTE: CSS is imported globally once (see src/main.tsx) because dynamic CSS import
 * can fail in production builds and cause a blank screen.
 */

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import type { GeoJSONPolygon, Zone } from '../../../facades/viewmodels.js'
import { polygonsOverlap } from '../../../lib/geometry.js'

interface DrawingToolbarProps {
  /** Callback when user finishes drawing a polygon. */
  onZoneCreated: (polygon: GeoJSONPolygon, centroid: { lat: number; lng: number }) => void
  /** Callback when user edits an existing zone polygon. */
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

  // Keep latest zones for overlap validation without re-initializing Leaflet.Draw
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
          edit: true,
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
              alert(`Polygon mới chồng lắp với vùng "${zone.name}". Vui lòng vẽ lại.`)
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
                alert('Polygon sửa bị chồng lắp vùng khác. Đã hoàn tác.')
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

  // Keep selected-zone edit layer in sync without recreating the whole draw control.
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

    // IMPORTANT: must be interactive for Leaflet.Draw edit handles to work.
    // If interactive is false, the polygon will not receive pointer events and edits feel "non-clickable".
    const layer = L.polygon(latlngs, { color: '#2563eb', weight: 2, fillOpacity: 0.05, interactive: true })
    ;(layer as any).__zoneId = selectedZone.id
    selectedLayerRef.current = layer
    selectedOriginalRingRef.current = layerToRing(layer)
    drawnItems.addLayer(layer)
  }, [selectedZone])

  // Hook-only component - no JSX output
  return null
}
