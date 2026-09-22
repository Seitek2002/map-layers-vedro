import { LayerActionsProvider } from "./context/LayerActionsContext";
import { LayerList } from "./components/LayerList";
import { Toolbar } from "./components/Toolbar";
import { LayerMap } from "./map/LayerMap";
import { LayersStoreProvider } from "./store/layersStore";

function App() {
  return (
    <LayersStoreProvider>
      <LayerActionsProvider>
        <h1>Картографические слои</h1>
        <p className="subtitle">React + TypeScript + vedro</p>
        <LayerMap />
        <Toolbar />
        <LayerList />
      </LayerActionsProvider>
    </LayersStoreProvider>
  );
}

export default App;
