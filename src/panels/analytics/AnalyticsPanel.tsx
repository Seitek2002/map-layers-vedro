import { useActions } from "../../app/actionsContext";
import { selectActiveLayerIds } from "../../store/selectors";
import { useAppSelector } from "../../store/store";
import { shallowEqualArrays } from "../../utils/record";
import { LayerChart } from "./LayerChart";

export function AnalyticsPanel() {
  const actions = useActions();
  const activeIds = useAppSelector(selectActiveLayerIds, shallowEqualArrays);
  const probe = useAppSelector((s) => s.probe);

  return (
    <section className="panel">
      <h2 className="panel__title">Аналитика</h2>
      <div className="analytics__scope">
        {probe ? (
          <>
            <span>
              Точка {probe.lngLat[1].toFixed(2)}° с.ш., {probe.lngLat[0].toFixed(2)}° в.д.
            </span>
            <button type="button" onClick={actions.clearProbe}>
              Весь регион
            </button>
          </>
        ) : (
          <span>Регион: среднее и диапазон мин–макс. Клик по карте — ряд в точке, клик по графику — выбор времени.</span>
        )}
      </div>
      {activeIds.length === 0 ? (
        <p className="chart__placeholder">Включите хотя бы один слой</p>
      ) : (
        activeIds.map((id) => <LayerChart key={id} id={id} />)
      )}
    </section>
  );
}
