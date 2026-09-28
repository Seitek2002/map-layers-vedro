import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "../../config/layers";
import type { LayerDefinition } from "../../domain/layer";
import { createScalarRenderer } from "./scalarRenderer";
import type { LayerRenderer } from "./types";
import { createVectorRenderer } from "./vectorRenderer";

/** Kind → renderer. The only switch a brand-new visualization type would touch. */
export function createRenderer(
  map: MapLibreMap,
  def: LayerDefinition<LayerId>,
  beforeId: string | undefined,
): LayerRenderer {
  switch (def.kind) {
    case "grid":
    case "points":
      return createScalarRenderer(map, def, beforeId);
    case "vectors":
      return createVectorRenderer(map, def, beforeId);
  }
}

export type { LayerRenderer } from "./types";
