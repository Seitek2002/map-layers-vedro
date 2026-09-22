export type LayerId = string;

export type LayerStatus = "idle" | "loading" | "success" | "error";

export interface LayerDefinition {
  readonly id: LayerId;
  readonly label: string;
}

export interface LayerState {
  readonly id: LayerId;
  readonly label: string;
  readonly enabled: boolean;
  readonly opacity: number;
  readonly status: LayerStatus;
  readonly error: string | null;
  /** Bumped on every fetch attempt; lets a row's rendered status be traced back to a specific request. */
  readonly requestVersion: number;
}

export interface LayersState {
  readonly layerIds: readonly LayerId[];
  readonly layers: Readonly<Record<LayerId, LayerState>>;
}
