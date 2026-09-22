import { MapContainer, TileLayer } from "react-leaflet";
import { GRID_BOUNDS } from "./layerGeometry";
import { useLayersSelector } from "../store/layersStore";
import { MapLayerOverlay } from "./MapLayerOverlay";

export function LayerMap() {
  // Same split as LayerList/LayerRow: this only re-renders when a layer is
  // added or removed, each MapLayerOverlay handles its own slice.
  const layerIds = useLayersSelector((state) => state.layerIds);

  return (
    <div className="layer-map">
      <MapContainer bounds={GRID_BOUNDS} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {layerIds.map((id) => (
          <MapLayerOverlay key={id} id={id} />
        ))}
      </MapContainer>
    </div>
  );
}
