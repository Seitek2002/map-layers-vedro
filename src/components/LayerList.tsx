import { useLayersSelector } from "../store/layersStore";
import { LayerRow } from "./LayerRow";

export function LayerList() {
  // Ids only, never the layer bodies — adding/removing layers is the only
  // thing that should re-render this list; per-layer edits stay local to LayerRow.
  const layerIds = useLayersSelector((state) => state.layerIds);

  return (
    <ul className="layer-list">
      {layerIds.map((id) => (
        <LayerRow key={id} id={id} />
      ))}
    </ul>
  );
}
