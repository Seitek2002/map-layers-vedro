import { memo, useRef, type ChangeEvent } from "react";
import { useLayerActionsContext } from "../hooks/useLayerActionsContext";
import { useLayersSelector } from "../store/layersStore";
import type { LayerId } from "../types/layer";
import { OpacitySlider } from "./OpacitySlider";
import { StatusBadge } from "./StatusBadge";

interface LayerRowProps {
  id: LayerId;
}

function LayerRowImpl({ id }: LayerRowProps) {
  // Selecting only this layer's own slice means a dispatch touching a
  // *different* layer produces the same JSON for this selector, so Vedro's
  // equality check skips the setState and this row never re-renders for it.
  const layer = useLayersSelector((state) => state.layers[id]);
  const actions = useLayerActionsContext();

  // Deliberate render-count probe: proves visually, per row, that unrelated
  // layer/opacity updates elsewhere don't re-render this one. A plain counter
  // via useState would itself cause an extra render, so this reads/writes a
  // ref during render on purpose — safe here since the value is read-only
  // debug output, never fed back into logic or another component's props.
  const renderCount = useRef(0);
  // oxlint-disable-next-line react/refs
  const renderCountValue = ++renderCount.current;

  if (!layer) return null;

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    actions.setEnabled(id, event.target.checked);
  };

  return (
    <li className="layer-row" data-status={layer.status}>
      <label className="layer-row__toggle">
        <input type="checkbox" checked={layer.enabled} onChange={handleToggle} />
        <span>{layer.label}</span>
      </label>

      <OpacitySlider
        value={layer.opacity}
        disabled={!layer.enabled}
        onCommit={(opacity) => actions.setOpacity(id, opacity)}
      />

      <StatusBadge status={layer.status} />

      {layer.status === "error" && (
        <div className="layer-row__error">
          <span>{layer.error}</span>
          <button type="button" onClick={() => actions.retry(id)}>
            Повторить
          </button>
        </div>
      )}

      <span className="layer-row__debug" title="Сколько раз перерисован этот компонент">
        renders: {renderCountValue}
      </span>
    </li>
  );
}

export const LayerRow = memo(LayerRowImpl);
