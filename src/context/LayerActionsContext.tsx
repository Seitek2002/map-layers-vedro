import type { ReactNode } from "react";
import { useLayerActions } from "../hooks/useLayerActions";
import { LayerActionsContext } from "./layerActionsContextObject";

export function LayerActionsProvider({ children }: { children: ReactNode }) {
  const actions = useLayerActions();
  return (
    <LayerActionsContext.Provider value={actions}>{children}</LayerActionsContext.Provider>
  );
}
