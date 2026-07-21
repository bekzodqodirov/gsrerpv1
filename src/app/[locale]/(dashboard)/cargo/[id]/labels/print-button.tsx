"use client";

import { Button } from "@/components/ui";
import { icons } from "@/components/icons";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      {icons.printer("h-4.5 w-4.5")}
      {label}
    </Button>
  );
}
