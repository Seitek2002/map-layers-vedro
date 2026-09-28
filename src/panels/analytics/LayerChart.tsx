import { memo, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from "recharts";
import { useActions } from "../../app/actionsContext";
import { LAYERS, TIMELINE_AXIS, type LayerId } from "../../config/layers";
import { axisEnd, axisTimes, formatTime, type Timestamp } from "../../domain/time";
import { selectResolvedTime, selectSeriesKey } from "../../store/selectors";
import { useAppSelector } from "../../store/store";

interface ChartPoint {
  readonly t: Timestamp;
  readonly value: number;
  readonly range: readonly [number, number];
}

const X_DOMAIN: [number, number] = [TIMELINE_AXIS.start, axisEnd(TIMELINE_AXIS)];
const X_TICKS = axisTimes(TIMELINE_AXIS).filter((_, i) => i % 6 === 0);

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function tooltipIndex(index: number | string | null | undefined): number | null {
  const parsed = typeof index === "string" ? Number(index) : index;
  return typeof parsed === "number" && Number.isInteger(parsed) ? parsed : null;
}

/**
 * One chart per active layer (units differ, so no shared Y axis). All charts
 * share `syncId` with `syncMethod="value"`: hover syncs by time, not by array
 * index — layers publish on different cadences, so indices don't line up.
 */
function LayerChartImpl({ id }: { id: LayerId }) {
  const def = LAYERS[id];
  const actions = useActions();
  const resource = useAppSelector((s) => s.series[selectSeriesKey(s, id)]);
  const selected = useAppSelector((s) => s.timeline.selected);
  const resolved = useAppSelector((s) => selectResolvedTime(s, id));

  const series = resource?.status === "success" ? resource.data : null;
  // Recomputed only when the series object changes (new layer/probe data),
  // not on every timeline step — the time only moves the reference markers.
  const data = useMemo<ChartPoint[]>(
    () => series?.points.map((p) => ({ t: p.t, value: round(p.value), range: [round(p.min), round(p.max)] })) ?? [],
    [series],
  );
  const activePoint = data.find((p) => p.t === resolved);
  const showRange = series?.scope.type === "region";

  // Chart → state: clicking a point selects that time for the whole app.
  const handleClick = (state: MouseHandlerDataParam) => {
    const index = tooltipIndex(state.activeTooltipIndex);
    const point = index === null ? undefined : data[index];
    if (point) actions.selectTime(point.t);
  };

  return (
    <figure className="chart">
      <figcaption className="chart__title">
        <span className="layer-item__swatch" style={{ background: def.accent }} />
        {def.title}, {def.unit}
        {activePoint && (
          <span className="chart__value">
            {formatTime(activePoint.t)}: <strong>{activePoint.value}</strong>
          </span>
        )}
      </figcaption>

      {resource?.status === "error" ? (
        <p className="chart__placeholder chart__placeholder--error">
          {resource.message}
          <button type="button" onClick={() => actions.retryLayer(id)}>
            Повторить
          </button>
        </p>
      ) : series === null ? (
        <p className="chart__placeholder">Загрузка ряда…</p>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <ComposedChart
            data={data}
            syncId="timeline"
            syncMethod="value"
            onClick={handleClick}
            margin={{ top: 6, right: 12, bottom: 0, left: 0 }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e6ea" />
            <XAxis
              dataKey="t"
              type="number"
              domain={X_DOMAIN}
              ticks={X_TICKS}
              tickFormatter={formatTime}
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              width={40}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(value) =>
                Array.isArray(value) ? `${value[0]}…${value[1]} ${def.unit}` : `${String(value)} ${def.unit}`
              }
            />
            {showRange && (
              <Area dataKey="range" name="мин–макс" stroke="none" fill={def.accent} fillOpacity={0.15} isAnimationActive={false} />
            )}
            <Line
              dataKey="value"
              name={showRange ? "среднее" : "в точке"}
              stroke={def.accent}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <ReferenceLine x={selected} stroke="#1d3557" strokeDasharray="4 3" />
            {activePoint && (
              <ReferenceDot x={activePoint.t} y={activePoint.value} r={5} fill={def.accent} stroke="#fff" strokeWidth={2} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}

export const LayerChart = memo(LayerChartImpl);
