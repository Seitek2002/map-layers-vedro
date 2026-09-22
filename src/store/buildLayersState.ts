import type { LayerDefinition, LayerId, LayerState, LayersState } from "../types/layer";

const DEFAULT_OPACITY = 70;

export function createLayerState(definition: LayerDefinition): LayerState {
  return {
    id: definition.id,
    label: definition.label,
    enabled: false,
    opacity: DEFAULT_OPACITY,
    status: "idle",
    error: null,
    requestVersion: 0,
  };
}

export function buildLayersState(definitions: readonly LayerDefinition[]): LayersState {
  const layerIds: LayerId[] = [];
  const layers: Record<LayerId, LayerState> = {};

  for (const definition of definitions) {
    layerIds.push(definition.id);
    layers[definition.id] = createLayerState(definition);
  }

  return { layerIds, layers };
}
