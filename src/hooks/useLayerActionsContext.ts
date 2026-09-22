import { useContext } from "react";
import { LayerActionsContext } from "../context/layerActionsContextObject";
import type { LayerActions } from "../store/layerActions";

export function useLayerActionsContext(): LayerActions {
  const actions = useContext(LayerActionsContext);
  if (!actions) {
    throw new Error("useLayerActionsContext must be used within a LayerActionsProvider");
  }
  return actions;
}
