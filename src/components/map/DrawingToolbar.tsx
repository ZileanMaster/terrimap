/**
 * DrawingToolbar — Native Leaflet Draw polygon control (Admin only)
 *
 * Uses Leaflet Draw directly (not react-leaflet-draw wrapper) to avoid
 * ESM compatibility issues. Renders inside <MapContainer> via useMap().
 * Only polygon drawing is enabled; all other shapes are disabled.
 */

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import type { GeoJSONPolygon, Zone } from '../../../facades/viewmodels.js'
import { polygonsOverlap } from '../../../lib/geometry.js'

interface DrawingToolbarProps {
  /** Callback when user finishes drawing a polygon. */
  onZoneCreated: (polygon: GeoJSONPolygon, centroid: { lat: number; lng: number }) => void
  /** Existing zones for overlap validation. */
  existingZones?: Zone[]
}

export default function DrawingToolbar({ onZoneCreated, existingZones }: DrawingToolbarProps) {
  const map = useMap()

  useEffect(() => {
    // Feature group to hold drawn items
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    // Draw control — polygon only
    const drawControl = new (L.Control as any).Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: '#2563eb',
            weight: 2,
            fillOpacity: 0.15,
          },
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
        edit: false,
      },
    })

    map.addControl(drawControl)

    // Listen for polygon creation
    const onCreated = (e: any) => {
      const layer = e.layer
      const latlngs = layer.getLatLngs()[0] as L.LatLng[]

      // Convert Leaflet LatLng[] → GeoJSON coordinates [lng, lat][]
      const ring: [number, number][] = latlngs.map((ll) => [ll.lng, ll.lat])

      // Close polygon (GeoJSON spec: first === last point)
      if (ring.length > 0) {
        const first = ring[0]
        const last = ring[ring.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]])
        }
      }

      // ── OVERLAP VALIDATION ────────────────────────────────────
      if (existingZones && existingZones.length > 0) {
        for (const zone of existingZones) {
          const existingRing = zone.polygon.type === 'Polygon'
            ? zone.polygon.coordinates[0]
            : zone.polygon.coordinates[0]?.[0]

          if (existingRing && polygonsOverlap(ring, existingRing)) {
            // Reject: remove drawn layer & alert user
            drawnItems.removeLayer(layer)
            alert(`⚠️ Polygon mới chồng lắp với vùng "${zone.name}". Vui lòng vẽ lại.`)
            return
          }
        }
      }
      // ──────────────────────────────────────────────────────

      drawnItems.addLayer(layer)

      // Compute centroid (arithmetic mean)
      const lats = latlngs.map((ll) => ll.lat)
      const lngs = latlngs.map((ll) => ll.lng)
      const centroid = {
        lat: lats.reduce((a, b) => a + b, 0) / lats.length,
        lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
      }

      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [ring],
      }

      onZoneCreated(polygon, centroid)
    }

    map.on(L.Draw.Event.CREATED, onCreated)

    // Cleanup on unmount
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map, onZoneCreated, existingZones])

  // This is a hook-only component — no JSX output needed
  return null
}
