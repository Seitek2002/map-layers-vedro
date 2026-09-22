import { useEffect, useMemo, useState } from "react";
import { createLayerActions, type LayerActions } from "../store/layerActions";
import { useLayersStore } from "../store/layersStore";
import type { LayerId } from "../types/layer";

export function useLayerActions(): LayerActions {
  const store = useLayersStore();
  // Lazy useState (setter unused) gives a Map whose identity is stable across
  // re-renders, same as a ref would, without touching `.current` at render time.
  const [controllers] = useState(() => new Map<LayerId, AbortController>());

  useEffect(() => {
    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [controllers]);

  // `store` is a stable ref held by the Provider, so this object identity
  // never changes across renders — safe to hand to React.memo'd rows as a prop.
  return useMemo(() => createLayerActions(store, controllers), [store, controllers]);
}
