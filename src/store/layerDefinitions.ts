import type { LayerDefinition } from "../types/layer";

export const INITIAL_LAYER_DEFINITIONS: readonly LayerDefinition[] = [
  { id: "temperature", label: "Температура" },
  { id: "wind", label: "Ветер" },
  { id: "insolation", label: "Инсоляция" },
];
