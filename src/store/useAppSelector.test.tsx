import { act, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import type Vedro from "vedro";
import { createVedro } from "vedro";
import { describe, expect, it } from "vitest";
import type { LayerId } from "../config/layers";
import type { AppState } from "./state";
import { AppStoreProvider, useAppSelector, useAppStore } from "./store";

let captured: Vedro<AppState> | null = null;

function CaptureStore({ children }: { children: ReactNode }) {
  const store = useAppStore();
  useEffect(() => {
    captured = store;
  }, [store]);
  return children;
}

function renderWithStore(ui: ReactNode) {
  const utils = render(
    <AppStoreProvider>
      <CaptureStore>{ui}</CaptureStore>
    </AppStoreProvider>,
  );
  if (!captured) throw new Error("store not captured");
  return { ...utils, store: captured };
}

function Enabled({ layer }: { layer: LayerId }) {
  const enabled = useAppSelector((s) => s.layers[layer].enabled);
  return <span data-testid="value">{`${layer}:${String(enabled)}`}</span>;
}

describe("useAppSelector", () => {
  it("re-renders on dispatch", () => {
    const { store } = renderWithStore(<Enabled layer="insolation" />);
    expect(screen.getByTestId("value").textContent).toBe("insolation:false");

    act(() => store.dispatch((s) => ({ layers: { ...s.layers, insolation: { ...s.layers.insolation, enabled: true } } })));
    expect(screen.getByTestId("value").textContent).toBe("insolation:true");
  });

  it("follows a selector whose inputs are props", () => {
    const { rerender } = renderWithStore(<Enabled layer="temperature" />);
    expect(screen.getByTestId("value").textContent).toBe("temperature:true");

    // Same tree shape → same component instance, only the prop changes.
    rerender(
      <AppStoreProvider>
        <CaptureStore>
          <Enabled layer="insolation" />
        </CaptureStore>
      </AppStoreProvider>,
    );
    expect(screen.getByTestId("value").textContent).toBe("insolation:false");
  });
});

describe("vedro's own useSelector (why it is not used)", () => {
  it("keeps returning the first selector's value after props change", () => {
    const { Provider, useSelector } = createVedro({ a: "A", b: "B" });

    function Pick({ field }: { field: "a" | "b" }) {
      return <span data-testid="picked">{useSelector((s) => s[field])}</span>;
    }

    const { rerender } = render(
      <Provider>
        <Pick field="a" />
      </Provider>,
    );
    rerender(
      <Provider>
        <Pick field="b" />
      </Provider>,
    );
    // The selector was captured on mount; the prop change is ignored.
    expect(screen.getByTestId("picked").textContent).toBe("A");
  });
});
