import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { Zone } from '../../../facades/viewmodels.js'

const CLUSTER_THRESHOLD = 30

interface ClusterLayerProps {
  zones: Zone[]
  onZoneClick?: (zoneId: string) => void
}

export default function ClusterLayer({ zones, onZoneClick }: ClusterLayerProps) {
  const map = useMap()
  const leaflet = L as any

  useEffect(() => {
    if (zones.length <= CLUSTER_THRESHOLD) return

    const clusterGroup = leaflet.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount()
        const size = count > 50 ? 44 : count > 20 ? 40 : 36
        return leaflet.divIcon({
          html: `<div style="
            background: var(--color-accent, #2563eb);
            color: white;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size > 40 ? 14 : 13}px;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(0,0,0,.25);
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: leaflet.point(size, size),
        })
      },
    })

    for (const zone of zones) {
      const marker = leaflet.marker([zone.centroid.lat, zone.centroid.lng], {
        icon: leaflet.divIcon({
          html: `<div style="
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--color-accent, #2563eb);
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,.3);
          "></div>`,
          className: 'zone-dot-icon',
          iconSize: leaflet.point(12, 12),
          iconAnchor: leaflet.point(6, 6),
        }),
      })

      marker.bindTooltip(zone.name, { direction: 'top', offset: leaflet.point(0, -8) })
      if (onZoneClick) {
        marker.on('click', () => onZoneClick(zone.id))
      }
      clusterGroup.addLayer(marker)
    }

    map.addLayer(clusterGroup)

    return () => {
      map.removeLayer(clusterGroup)
    }
  }, [map, zones, onZoneClick])

  return null
}
