"use client";

import { useActionState } from "react";
import { Button, Input, Card } from "@/components/ui";
import { updateCapacityAction, type CapacityState } from "./actions";

type WH = {
  id: string;
  gsCode: string;
  name: string;
  country: string;
  capacityM3: string | null;
  capacityKg: string | null;
};
type Labels = {
  warehouse: string;
  capacityM3: string;
  capacityKg: string;
  save: string;
  saved: string;
};

function Row({ w, labels }: { w: WH; labels: Labels }) {
  const [state, action, pending] = useActionState<CapacityState, FormData>(
    updateCapacityAction,
    {},
  );
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 border-b border-line py-3 last:border-0"
    >
      <input type="hidden" name="warehouseId" value={w.id} />
      <div className="min-w-40 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold">{w.gsCode}</span>
          <span className="truncate font-medium">{w.name}</span>
          <span className="text-xs text-muted">
            {w.country === "CN" ? "🇨🇳" : "🇺🇿"}
          </span>
        </div>
      </div>
      <label className="text-xs">
        <span className="mb-1 block text-muted">{labels.capacityM3}</span>
        <Input
          name="capacityM3"
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          defaultValue={w.capacityM3 ?? ""}
          className="w-28"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted">{labels.capacityKg}</span>
        <Input
          name="capacityKg"
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          defaultValue={w.capacityKg ?? ""}
          className="w-32"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {labels.save}
      </Button>
      {state.ok && (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ {labels.saved}
        </span>
      )}
    </form>
  );
}

export function CapacityEditor({
  warehouses,
  labels,
}: {
  warehouses: WH[];
  labels: Labels;
}) {
  return (
    <Card className="p-4">
      {warehouses.map((w) => (
        <Row key={w.id} w={w} labels={labels} />
      ))}
    </Card>
  );
}
