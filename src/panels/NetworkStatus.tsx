import { DEFAULT_MOCK_OPTIONS } from "../data/mockApi";
import { useAppSelector } from "../store/store";

const [MIN_LATENCY, MAX_LATENCY] = DEFAULT_MOCK_OPTIONS.latencyMs;

/** Makes the race-condition handling observable: scrub the timeline fast and watch "отменено" grow. */
export function NetworkStatus() {
  const network = useAppSelector((s) => s.network);
  return (
    <section className="panel network">
      <h2 className="panel__title">Запросы к mock API</h2>
      <dl className="network__stats">
        <div><dt>в полёте</dt><dd>{network.inFlight}</dd></div>
        <div><dt>выполнено</dt><dd>{network.completed}</dd></div>
        <div><dt>отменено</dt><dd>{network.aborted}</dd></div>
        <div><dt>ошибок</dt><dd>{network.failed}</dd></div>
      </dl>
      <p className="network__note">
        Задержка {MIN_LATENCY}–{MAX_LATENCY} мс, {Math.round(DEFAULT_MOCK_OPTIONS.failureRate * 100)}% ошибок —
        ответы нарочно приходят не по порядку.
      </p>
    </section>
  );
}
