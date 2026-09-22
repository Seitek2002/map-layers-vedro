import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mockApi from "../api/mockLayerApi";
import { LayerActionsProvider } from "../context/LayerActionsContext";
import { LayersStoreProvider } from "../store/layersStore";
import { LayerList } from "./LayerList";

// Each render() mounts a fresh <LayersStoreProvider>, and vedro's Provider
// creates its own Vedro instance per mount (see useRef in createVedro's
// Provider) — so tests don't leak state into one another despite the store
// module being a singleton.
function renderLayerList() {
  return render(
    <LayersStoreProvider>
      <LayerActionsProvider>
        <LayerList />
      </LayerActionsProvider>
    </LayersStoreProvider>,
  );
}

describe("LayerList (full React + vedro integration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enabling a layer drives it through loading to success in the DOM", async () => {
    vi.spyOn(mockApi, "fetchLayerData").mockResolvedValue({
      layerId: "temperature",
      fetchedAt: Date.now(),
    });

    renderLayerList();

    fireEvent.click(screen.getByRole("checkbox", { name: "Температура" }));

    expect(await screen.findByText("Готово")).toBeInTheDocument();
  });

  it("an error status shows a retry button that recovers on click", async () => {
    vi.spyOn(mockApi, "fetchLayerData")
      .mockRejectedValueOnce(new mockApi.LayerRequestError("wind"))
      .mockResolvedValueOnce({ layerId: "wind", fetchedAt: Date.now() });

    renderLayerList();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ветер" }));
    const retryButton = await screen.findByRole("button", { name: "Повторить" });

    fireEvent.click(retryButton);

    expect(await screen.findByText("Готово")).toBeInTheDocument();
  });

  it("does not re-render a sibling row when a different layer changes", async () => {
    vi.spyOn(mockApi, "fetchLayerData").mockResolvedValue({
      layerId: "temperature",
      fetchedAt: Date.now(),
    });

    renderLayerList();

    const insolationRow = screen.getByRole("checkbox", { name: "Инсоляция" }).closest("li");
    if (!insolationRow) throw new Error("row not found");
    const before = within(insolationRow).getByTitle("Сколько раз перерисован этот компонент")
      .textContent;

    fireEvent.click(screen.getByRole("checkbox", { name: "Температура" }));
    await screen.findByText("Готово");

    const after = within(insolationRow).getByTitle("Сколько раз перерисован этот компонент")
      .textContent;
    expect(after).toBe(before);
  });
});
