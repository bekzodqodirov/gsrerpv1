import { icons } from "@/components/icons";

// CSV eksport tugmasi (oddiy yuklab olish havolasi — /api/export?type=).
export function ExportLink({ type, label }: { type: string; label: string }) {
  return (
    <a
      href={`/api/export?type=${type}`}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
    >
      {icons.printer("h-4 w-4")}
      {label}
    </a>
  );
}
