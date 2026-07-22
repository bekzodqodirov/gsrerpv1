// CSV eksport (Excel'da ochiladi). /api/export?type=... — sessiya talab qilinadi.
import { toCsv, csvResponse } from "@/modules/shared/csv";
import {
  getBatchProfitability,
  listExpenses,
  getMonthlyPnl,
} from "@/modules/finance/expenses";
import { getDebtors } from "@/modules/finance/billing";
import { getStockOverview } from "@/modules/stock/service";
import { getBatch } from "@/modules/tms/service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  try {
    switch (type) {
      case "batchplan": {
        const batchId = url.searchParams.get("batch") ?? "";
        const data = await getBatch(batchId);
        if (!data) return new Response("not found", { status: 404 });
        return csvResponse(
          `plan-${data.batch.code}.csv`,
          toCsv(
            [
              "Zona",
              "Mijoz",
              "Kod",
              "Tovar",
              "Reg",
              "Plan (karobka)",
              "Yuklandi",
              "Qoldi",
              "Og'irlik kg (plan)",
              "Hajm m3 (plan)",
            ],
            data.lines.map((l) => [
              l.zone ?? "",
              l.clientCode,
              `${l.clientCode}-${l.letterCode}`,
              l.productName,
              l.regNumber,
              l.planned,
              l.loaded,
              Math.max(0, l.planned - l.loaded),
              Math.round(l.plannedKg * 1000) / 1000,
              Math.round(l.plannedM3 * 10000) / 10000,
            ]),
          ),
        );
      }
      case "profitability": {
        const { rows } = await getBatchProfitability();
        return csvResponse(
          "partiya-foydasi.csv",
          toCsv(
            ["Partiya", "Yo'nalish", "Daromad USD", "Xarajat USD", "Foyda USD", "Foyda %"],
            rows.map((r) => [r.code, `${r.originGs} -> ${r.destGs}`, r.revenueUsd, r.costUsd, r.marginUsd, r.marginPct ?? ""]),
          ),
        );
      }
      case "debtors": {
        const { rows } = await getDebtors();
        return csvResponse(
          "qarzdorlar.csv",
          toCsv(
            ["Kod", "Mijoz", "Balans USD", "Kun"],
            rows.map((r) => [r.code, r.name, r.balanceUsd, r.oldestDays]),
          ),
        );
      }
      case "expenses": {
        const { rows } = await listExpenses();
        return csvResponse(
          "xarajatlar.csv",
          toCsv(
            ["Sana", "Turkum", "Bog'liq", "Summa", "Valyuta", "USD", "Izoh"],
            rows.map((r) => [
              r.spentAt,
              r.category,
              r.batchCode ?? r.warehouseCode ?? r.carrierName ?? "",
              r.amount,
              r.currency,
              r.amountUsd,
              r.note ?? "",
            ]),
          ),
        );
      }
      case "stock": {
        const { warehouses } = await getStockOverview();
        return csvResponse(
          "ombor-qoldigi.csv",
          toCsv(
            ["Ombor", "Nomi", "Karobka", "Og'irlik kg", "Hajm m3", "Mijozlar", "Eng eski kun"],
            warehouses.map((w) => [w.gsCode, w.name, w.totalBoxes, w.totalWeightKg, w.totalVolumeM3, w.clientCount, w.oldestDays]),
          ),
        );
      }
      case "pnl": {
        const { rows } = await getMonthlyPnl();
        return csvResponse(
          "oylik-pnl.csv",
          toCsv(
            ["Oy", "Daromad USD", "Xarajat USD", "Foyda USD"],
            rows.map((r) => [r.month, r.revenueUsd, r.expenseUsd, r.marginUsd]),
          ),
        );
      }
      default:
        return new Response("unknown type", { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") return new Response("unauthorized", { status: 401 });
    if (msg.startsWith("FORBIDDEN")) return new Response("forbidden", { status: 403 });
    console.error("[export]", e);
    return new Response("error", { status: 500 });
  }
}
