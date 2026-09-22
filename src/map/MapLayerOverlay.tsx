import { memo } from "react";
import { Rectangle, Tooltip } from "react-leaflet";
import { useLayersSelector } from "../store/layersStore";
import type { LayerId } from "../types/layer";
import { deriveLayerGeometry } from "./layerGeometry";

interface MapLayerOverlayProps {
  id: LayerId;
}

function MapLayerOverlayImpl({ id }: MapLayerOverlayProps) {
  // Same per-layer slice selector as LayerRow: toggling/loading one layer
  // never re-renders the other overlays already on the map.
  const layer = useLayersSelector((state) => state.layers[id]);

  if (!layer || !layer.enabled || layer.status !== "success") return null;

  const { bounds, color } = deriveLayerGeometry(id);

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{ color, fillColor: color, fillOpacity: layer.opacity / 100, weight: 1 }}
    >
      <Tooltip sticky>
        {layer.label} · {layer.opacity}%
      </Tooltip>
    </Rectangle>
  );
}

export const MapLayerOverlay = memo(MapLayerOverlayImpl);
