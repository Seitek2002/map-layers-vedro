import type Vedro from "vedro";
import { createVedro } from "vedro";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";
import { createInitialState, type AppState } from "./state";

export type AppStore = Vedro<AppState>;

/**
 * Vedro owns the state: the Provider creates one store per mount, and all
 * writes go through `store.dispatch`. Its `useSelector` is intentionally not
 * used — see `useAppSelector` below.
 */
export const { Provider: AppStoreProvider, useStore: useAppStore } = createVedro<AppState>(createInitialState());

/**
 * Safe `store.on("@state")`. Vedro's unsubscribe does
 * `splice(indexOf(cb), 1)`, so a second call (indexOf → -1) would silently
 * remove the *last* listener of someone else — the guard makes it idempotent.
 */
export function subscribe(store: AppStore, listener: () => void): () => void {
  const unsubscribe = store.on("@state", () => listener());
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}

interface Binding {
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getSnapshot: () => AppState;
}

const bindings = new WeakMap<AppStore, Binding>();

function getBinding(store: AppStore): Binding {
  const existing = bindings.get(store);
  if (existing) return existing;

  // `store.get()` returns a fresh shallow copy on every call; React needs a
  // snapshot that only changes identity when state actually changes.
  let snapshot = store.get();
  subscribe(store, () => {
    // Re-read rather than trust the callback's argument: if a listener
    // dispatches while vedro is still notifying, later listeners receive the
    // *older* state from the outer loop.
    snapshot = store.get();
  });

  const binding: Binding = {
    subscribe: (onChange) => subscribe(store, onChange),
    getSnapshot: () => snapshot,
  };
  bindings.set(store, binding);
  return binding;
}

/**
 * Replacement for vedro's `useSelector`, which (read from its source):
 * - captures the selector once on mount (`useEffect(..., [])`), so a selector
 *   that depends on props keeps reading the old props;
 * - misses dispatches that happen between render and its effect subscribing;
 * - decides re-renders with `JSON.stringify(prev) === JSON.stringify(next)`
 *   on every dispatch for every subscriber — too slow for typed-array frames.
 * `useSyncExternalStore` is React's own contract for external stores and
 * fixes all three; equality is explicit and cheap (`Object.is` by default).
 */
export function useAppSelector<T>(
  selector: (state: AppState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const binding = getBinding(useAppStore());
  return useSyncExternalStoreWithSelector(
    binding.subscribe,
    binding.getSnapshot,
    binding.getSnapshot,
    selector,
    isEqual,
  );
}
