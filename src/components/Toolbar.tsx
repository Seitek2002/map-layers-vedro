import { useState, type FormEvent } from "react";
import { useLayerActionsContext } from "../hooks/useLayerActionsContext";
import { useLayersSelector } from "../store/layersStore";

export function Toolbar() {
  const actions = useLayerActionsContext();
  const totalCount = useLayersSelector((state) => state.layerIds.length);
  const activeCount = useLayersSelector(
    (state) => Object.values(state.layers).filter((layer) => layer.enabled).length,
  );
  const [bulkCount, setBulkCount] = useState("100");

  const handleAddLayers = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(bulkCount);
    if (Number.isFinite(count) && count > 0) {
      actions.addLayers(Math.floor(count));
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar__stats">
        Слоёв: {totalCount} · Включено: {activeCount}
      </div>
      <form className="toolbar__bulk" onSubmit={handleAddLayers}>
        <input
          type="number"
          min={1}
          value={bulkCount}
          onChange={(event) => setBulkCount(event.target.value)}
          aria-label="Количество слоёв для добавления"
        />
        <button type="submit">Добавить слои (тест масштабирования)</button>
      </form>
      <button type="button" onClick={actions.reset}>
        Сбросить
      </button>
    </div>
  );
}
