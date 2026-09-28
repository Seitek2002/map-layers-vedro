import { useEffect } from "react";
import { useActions } from "../../app/actionsContext";
import { selectActiveFramesSettled } from "../../store/selectors";
import { useAppStore } from "../../store/store";

const PLAYBACK_STEP_MS = 900;

/**
 * Advances the timeline while playing. Reads the store imperatively on each
 * tick (no re-render) and skips a tick while any active layer is still
 * loading, so playback never runs ahead of the data. The next step is
 * prefetched by data sync while playing, so usually nothing waits.
 */
export function usePlayback(playing: boolean): void {
  const store = useAppStore();
  const actions = useActions();

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (selectActiveFramesSettled(store.get())) actions.stepTime(1);
    }, PLAYBACK_STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, store, actions]);
}
