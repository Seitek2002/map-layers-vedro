import { createContext } from "react";
import type { LayerActions } from "../store/layerActions";

export const LayerActionsContext = createContext<LayerActions | null>(null);
