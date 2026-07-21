"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Select } from "@/components/ui";

type ClientOption = { id: string; code: string; name: string };

export function ClientPicker({
  clients,
  current,
}: {
  clients: ClientOption[];
  current?: string;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  return (
    <Select
      defaultValue={current ?? ""}
      className="w-auto min-w-64"
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.push(`/finance/invoices/new?client=${v}`);
      }}
    >
      <option value="" disabled>
        {t("selectClient")}
      </option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} — {c.name}
        </option>
      ))}
    </Select>
  );
}
