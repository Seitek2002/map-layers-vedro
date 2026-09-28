import { memo, useMemo } from "react";
import { useActions } from "../../app/actionsContext";
import { LAYERS, TIMELINE_AXIS, type LayerId } from "../../config/layers";
import {
  axisEnd,
  axisTimes,
  formatDate,
  formatTime,
  indexOnAxis,
  resolveValidTime,
  type Timestamp,
} from "../../domain/time";
import { selectActiveLayerIds } from "../../store/selectors";
import { useAppSelector } from "../../store/store";
import { shallowEqualArrays } from "../../utils/record";
import { usePlayback } from "./usePlayback";

const SPAN = axisEnd(TIMELINE_AXIS) - TIMELINE_AXIS.start;
const position = (t: Timestamp) => `${((t - TIMELINE_AXIS.start) / SPAN) * 100}%`;
const LABELLED_TICKS = axisTimes(TIMELINE_AXIS).filter((_, i) => i % 3 === 0);

/** One row per active layer: its own time steps and which one the selected time resolves to. */
const CoverageRow = memo(function CoverageRow({ id, selected }: { id: LayerId; selected: Timestamp }) {
  const actions = useActions();
  const { title, timeAxis, accent } = LAYERS[id];
  const steps = useMemo(() => axisTimes(timeAxis), [timeAxis]);
  const resolved = resolveValidTime(timeAxis, selected);
  const start = (timeAxis.start - TIMELINE_AXIS.start) / SPAN;
  const end = (axisEnd(timeAxis) - TIMELINE_AXIS.start) / SPAN;

  return (
    <div className={resolved === null ? "coverage coverage--empty" : "coverage"}>
      <span className="coverage__label">{title}</span>
      <div className="coverage__track">
        <span
          className="coverage__range"
          style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%`, background: accent }}
        />
        {steps.map((t) => (
          <button
            key={t}
            type="button"
            className={t === resolved ? "coverage__step is-active" : "coverage__step"}
            style={{ left: position(t), borderColor: accent }}
            onClick={() => actions.selectTime(t)}
            aria-label={`${title}: ${formatTime(t)}`}
          />
        ))}
      </div>
    </div>
  );
});

export function Timeline() {
  const actions = useActions();
  const selected = useAppSelector((s) => s.timeline.selected);
  const playing = useAppSelector((s) => s.timeline.playing);
  const activeIds = useAppSelector(selectActiveLayerIds, shallowEqualArrays);
  usePlayback(playing);

  return (
    <section className="timeline" aria-label="Временная шкала">
      <div className="timeline__controls">
        <button type="button" onClick={() => actions.stepTime(-1)} aria-label="Предыдущий час">
          ‹
        </button>
        <button type="button" className="timeline__play" onClick={() => actions.setPlaying(!playing)}>
          {playing ? "Пауза" : "Воспроизвести"}
        </button>
        <button type="button" onClick={() => actions.stepTime(1)} aria-label="Следующий час">
          ›
        </button>
        <div className="timeline__current">
          <strong>{formatTime(selected)}</strong>
          <span>{formatDate(selected)}, Бишкек</span>
        </div>
      </div>

      <div className="timeline__body">
        <input
          className="timeline__slider"
          type="range"
          min={0}
          max={TIMELINE_AXIS.count - 1}
          step={1}
          value={indexOnAxis(TIMELINE_AXIS, selected)}
          onChange={(event) =>
            actions.selectTime(TIMELINE_AXIS.start + Number(event.target.value) * TIMELINE_AXIS.stepMs)
          }
          aria-valuetext={formatTime(selected)}
        />
        <div className="timeline__ticks">
          {LABELLED_TICKS.map((t) => (
            <span key={t} style={{ left: position(t) }}>
              {formatTime(t)}
            </span>
          ))}
        </div>
        {activeIds.map((id) => (
          <CoverageRow key={id} id={id} selected={selected} />
        ))}
      </div>
    </section>
  );
}
