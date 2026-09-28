import { memo } from "react";
import { useActions } from "../../app/actionsContext";
import { LAYERS, type LayerId } from "../../config/layers";
import { rampToCssGradient } from "../../domain/colorRamp";
import type { LayerKind } from "../../domain/layer";
import { formatAxisRange } from "../../domain/time";
import { selectLayerFrame, selectLayerStatus, type LayerStatus } from "../../store/selectors";
import { useAppSelector } from "../../store/store";

const STATUS_LABEL: Record<LayerStatus, string> = {
  off: "выключен",
  "no-data": "нет данных",
  loading: "загрузка…",
  ready: "готово",
  error: "ошибка",
};

const KIND_LABEL: Record<LayerKind, string> = {
  grid: "сетка",
  points: "точки",
  vectors: "векторы",
};

function LayerItemImpl({ id }: { id: LayerId }) {
  const def = LAYERS[id];
  const actions = useActions();
  // Each selector returns a primitive or a stable reference, so this item
  // re-renders only when *its* layer changes — not when another layer or the
  // timeline does (unless that changes this layer's status).
  const settings = useAppSelector((s) => s.layers[id]);
  const status = useAppSelector((s) => selectLayerStatus(s, id));
  const error = useAppSelector((s) => {
    const frame = selectLayerFrame(s, id);
    return frame?.status === "error" ? frame.message : null;
  });

  return (
    <li className={`layer-item layer-item--${status}`}>
      <label className="layer-item__header">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => actions.setLayerEnabled(id, event.target.checked)}
        />
        <span className="layer-item__swatch" style={{ background: def.accent }} />
        <span className="layer-item__title">{def.title}</span>
        <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
      </label>

      {settings.enabled && (
        <div className="layer-item__body">
          <div className="legend">
            <span className="legend__bar" style={{ background: rampToCssGradient(def.ramp) }} />
            <span className="legend__labels">
              <span>{def.domain[0]}</span>
              <span>{def.unit}</span>
              <span>{def.domain[1]}</span>
            </span>
          </div>

          <label className="layer-item__opacity">
            <span>Непрозрачность</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(event) => actions.setLayerOpacity(id, Number(event.target.value))}
            />
            <span>{Math.round(settings.opacity * 100)}%</span>
          </label>

          <p className="layer-item__meta">
            {formatAxisRange(def.timeAxis)} · {KIND_LABEL[def.kind]} {def.grid.cols}×{def.grid.rows}
          </p>

          {status === "no-data" && <p className="layer-item__note">Слой не публикуется на выбранное время</p>}
          {status === "error" && (
            <p className="layer-item__error">
              {error}
              <button type="button" onClick={() => actions.retryLayer(id)}>
                Повторить
              </button>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export const LayerItem = memo(LayerItemImpl);
