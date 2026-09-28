import { LAYER_ORDER } from "../../config/layers";
import { LayerItem } from "./LayerItem";

export function LayerPanel() {
  return (
    <section className="panel">
      <h2 className="panel__title">Слои</h2>
      <ul className="layer-list">
        {LAYER_ORDER.map((id) => (
          <LayerItem key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
