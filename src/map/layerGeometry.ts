import type { LatLngBoundsExpression } from "leaflet";
import type { LayerId } from "../types/layer";

// Base area the demo overlays are scattered across (roughly Europe) — purely
// illustrative, the mock API has no real geodata to render.
const BASE_LAT = 54;
const BASE_LNG = 30;
const GRID_SIZE = 12; // cells per axis — keeps collisions rare up to 100+ layers
const SPREAD = 8; // degrees covered by the whole grid, per axis — sized to fit the map's default view
const CELL_PITCH = SPREAD / GRID_SIZE;
// Smaller than the pitch on purpose: without a gap, two layers hashed into
// *adjacent* (not just identical) cells would still visually overlap.
const CELL_SIZE = CELL_PITCH * 0.75;

const EXPLICIT_COLORS: Readonly<Record<LayerId, string>> = {
  temperature: "#e05555",
  wind: "#3a7fd9",
  insolation: "#e0b13a",
};

const FALLBACK_PALETTE = [
  "#8a5fd9",
  "#4fae6a",
  "#d97a3a",
  "#3ab0b0",
  "#c04f9e",
  "#7a9b3a",
] as const;

function pickPaletteColor(hash: number): string {
  // FALLBACK_PALETTE[0] is a literal tuple index, so it's always `string`
  // (never undefined) even under noUncheckedIndexedAccess — the modulo'd
  // access above it is a computed index, which is where that flag kicks in.
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] ?? FALLBACK_PALETTE[0];
}

/** Deterministic (non-cryptographic) string hash, so geometry stays stable across renders. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export interface LayerGeometry {
  readonly bounds: LatLngBoundsExpression;
  readonly color: string;
}

// The full extent every generated cell can fall within. Handed to Leaflet's
// `bounds` prop so it fits/zooms itself correctly — Mercator distorts
// vertical degree-span with latitude, so a hand-picked center+zoom doesn't
// reliably keep an 8x8deg grid in view across container sizes.
export const GRID_BOUNDS: LatLngBoundsExpression = [
  [BASE_LAT - SPREAD / 2, BASE_LNG - SPREAD / 2],
  [BASE_LAT + SPREAD / 2, BASE_LNG + SPREAD / 2],
];

/**
 * Pure function of the layer id — no geometry is stored in the store, so it
 * stays free of presentation concerns and scales to generated demo layers
 * without any extra state.
 */
export function deriveLayerGeometry(id: LayerId): LayerGeometry {
  const hash = hashString(id);
  const col = hash % GRID_SIZE;
  const row = Math.floor(hash / GRID_SIZE) % GRID_SIZE;

  const south = BASE_LAT - SPREAD / 2 + row * CELL_PITCH;
  const west = BASE_LNG - SPREAD / 2 + col * CELL_PITCH;

  const bounds: LatLngBoundsExpression = [
    [south, west],
    [south + CELL_SIZE, west + CELL_SIZE],
  ];

  const color = EXPLICIT_COLORS[id] ?? pickPaletteColor(hash);

  return { bounds, color };
}
