"use client";

import { Button } from "@/components/ui";
import { icons } from "@/components/icons";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      {icons.printer("h-4 w-4")}
      {label}
    </Button>
  );
}
