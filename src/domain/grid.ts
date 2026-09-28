export type LngLat = readonly [lng: number, lat: number];

export interface BBox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/** Regular lon/lat grid. A layer's spatial resolution; cell geometry is derived, never stored. */
export interface GridSpec {
  readonly bbox: BBox;
  readonly cols: number;
  readonly rows: number;
}

export type CellIndex = number;

export function cellCount(grid: GridSpec): number {
  return grid.cols * grid.rows;
}

function cellSize(grid: GridSpec): { width: number; height: number } {
  return {
    width: (grid.bbox.east - grid.bbox.west) / grid.cols,
    height: (grid.bbox.north - grid.bbox.south) / grid.rows,
  };
}

export function cellBounds(grid: GridSpec, cell: CellIndex): BBox {
  const { width, height } = cellSize(grid);
  const col = cell % grid.cols;
  const row = Math.floor(cell / grid.cols);
  const west = grid.bbox.west + col * width;
  const south = grid.bbox.south + row * height;
  return { west, south, east: west + width, north: south + height };
}

export function cellCenter(grid: GridSpec, cell: CellIndex): LngLat {
  const b = cellBounds(grid, cell);
  return [(b.west + b.east) / 2, (b.south + b.north) / 2];
}

export function containsPoint(bbox: BBox, [lng, lat]: LngLat): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export function cellAt(grid: GridSpec, point: LngLat): CellIndex | null {
  if (!containsPoint(grid.bbox, point)) return null;
  const { width, height } = cellSize(grid);
  const col = Math.min(grid.cols - 1, Math.floor((point[0] - grid.bbox.west) / width));
  const row = Math.min(grid.rows - 1, Math.floor((point[1] - grid.bbox.south) / height));
  return row * grid.cols + col;
}
