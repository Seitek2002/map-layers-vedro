import { createContext, useContext } from "react";
import type { AppActions } from "../store/actions";

export const ActionsContext = createContext<AppActions | null>(null);

export function useActions(): AppActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("useActions must be used inside <AppServices>");
  return actions;
}
