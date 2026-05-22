/**
 * Type declarations for leaflet.markercluster
 * Since @types/leaflet.markercluster may not be available or compatible.
 */

import * as L from 'leaflet'

declare module 'leaflet' {
  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup

  interface MarkerClusterGroupOptions {
    maxClusterRadius?: number
    spiderfyOnMaxZoom?: boolean
    showCoverageOnHover?: boolean
    zoomToBoundsOnClick?: boolean
    iconCreateFunction?: (cluster: MarkerCluster) => L.DivIcon | L.Icon
  }

  interface MarkerClusterGroup extends L.FeatureGroup {
    addLayer(layer: L.Layer): this
    removeLayer(layer: L.Layer): this
    clearLayers(): this
  }

  interface MarkerCluster {
    getChildCount(): number
  }
}
