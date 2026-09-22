import { createVedro } from "vedro";
import type { LayersState } from "../types/layer";
import { buildLayersState } from "./buildLayersState";
import { INITIAL_LAYER_DEFINITIONS } from "./layerDefinitions";

export const initialLayersState: LayersState = buildLayersState(INITIAL_LAYER_DEFINITIONS);

export const {
  Provider: LayersStoreProvider,
  useStore: useLayersStore,
  useSelector: useLayersSelector,
} = createVedro<LayersState>(initialLayersState);

export type LayersStore = ReturnType<typeof useLayersStore>;
