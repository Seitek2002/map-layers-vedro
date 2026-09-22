import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

interface OpacitySliderProps {
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}

// Dragging fires onChange on every pixel; committing straight to the store
// would fan a dispatch out to every mounted selector on every tick. Instead
// we update local visual state instantly and commit to Vedro at a lower rate.
const COMMIT_DELAY_MS = 80;

function OpacitySliderImpl({ value, disabled, onCommit }: OpacitySliderProps) {
  const [draft, setDraft] = useState(value);
  // Tracks the last `value` we've synced from, so an external opacity change
  // (nothing else writes it today, but the row could gain one) can reset the
  // draft without an effect-triggered extra render.
  const [syncedValue, setSyncedValue] = useState(value);
  const timerRef = useRef<number | null>(null);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      setDraft(next);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onCommit(next), COMMIT_DELAY_MS);
    },
    [onCommit],
  );

  return (
    <label className="opacity-slider">
      <span>Прозрачность: {draft}%</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={draft}
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
}

export const OpacitySlider = memo(OpacitySliderImpl);
