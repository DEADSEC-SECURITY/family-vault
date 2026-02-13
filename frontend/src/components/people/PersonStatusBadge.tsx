"use client";

const STATUS_CONFIG = {
  invited: {
    label: "Invited",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-600",
  },
  active: {
    label: "Active",
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-600",
  },
  inactive: {
    label: "Inactive",
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-500",
  },
} as const;

export function PersonStatusBadge({
  status,
  size = "default",
}: {
  status: "none" | "invited" | "active" | "inactive";
  size?: "default" | "compact";
}) {
  if (status === "none") return null;

  const config = STATUS_CONFIG[status];
  const sizeClasses =
    size === "compact"
      ? "gap-1 px-2 py-0.5 text-xs"
      : "gap-2 px-3 py-1.5 text-sm";
  const dotSize = size === "compact" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div
      className={`inline-flex items-center ${sizeClasses} ${config.bg} ${config.text} rounded-full font-medium`}
    >
      <div className={`${dotSize} ${config.dot} rounded-full`} />
      {config.label}
    </div>
  );
}
