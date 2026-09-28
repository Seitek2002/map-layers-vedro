import { useEffect, useMemo, type ReactNode } from "react";
import type { LayerDataApi } from "../data/api";
import { startDataSync } from "../data/dataSync";
import { createActions } from "../store/actions";
import { useAppStore } from "../store/store";
import { ActionsContext } from "./actionsContext";

/**
 * Wires the non-React services to the store the Provider created: actions
 * (stable for the store's lifetime) and the data sync loop.
 */
export function AppServices({ api, children }: { api: LayerDataApi; children: ReactNode }) {
  const store = useAppStore();
  const actions = useMemo(() => createActions(store), [store]);

  useEffect(() => startDataSync(store, api), [store, api]);

  return <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>;
}
