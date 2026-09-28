import { createMockApi } from "../data/mockApi";
import { MapView } from "../map/MapView";
import { AnalyticsPanel } from "../panels/analytics/AnalyticsPanel";
import { LayerPanel } from "../panels/layers/LayerPanel";
import { NetworkStatus } from "../panels/NetworkStatus";
import { Timeline } from "../panels/timeline/Timeline";
import { AppStoreProvider } from "../store/store";
import { AppServices } from "./AppServices";

const api = createMockApi();

export function App() {
  return (
    <AppStoreProvider>
      <AppServices api={api}>
        <div className="app">
          <header className="app__header">
            <h1>Метеослои · Кыргызстан</h1>
            <span>React · TypeScript · Vedro · MapLibre GL · Recharts</span>
          </header>
          <main className="app__map">
            <MapView />
          </main>
          <div className="app__timeline">
            <Timeline />
          </div>
          <aside className="app__sidebar">
            <LayerPanel />
            <AnalyticsPanel />
            <NetworkStatus />
          </aside>
        </div>
      </AppServices>
    </AppStoreProvider>
  );
}
