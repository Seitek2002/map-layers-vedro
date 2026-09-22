import { memo } from "react";
import type { LayerStatus } from "../types/layer";

const LABELS: Record<LayerStatus, string> = {
  idle: "Выключен",
  loading: "Загрузка…",
  success: "Готово",
  error: "Ошибка",
};

interface StatusBadgeProps {
  status: LayerStatus;
}

function StatusBadgeImpl({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}

export const StatusBadge = memo(StatusBadgeImpl);
