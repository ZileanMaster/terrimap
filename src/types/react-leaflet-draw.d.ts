


declare module 'leaflet-draw' {
  // Side-effect import — adds L.Draw and L.Control.Draw to leaflet
}

declare module 'leaflet' {
  namespace Draw {
    const Event: {
      readonly CREATED: string
      readonly EDITED: string
      readonly DELETED: string
      readonly DRAWSTART: string
      readonly DRAWSTOP: string
    }
  }
}
