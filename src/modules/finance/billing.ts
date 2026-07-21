// Invoyslar, to'lovlar va mijoz balansi (ledger).
//
// Ledger — USD bazasida. Har qarz (invoys) va to'lov shu yerga yoziladi;
// joriy qoldiq = barcha yozuvlar yig'indisi (musbat = mijoz qarzdor).
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  invoiceLines,
  payments,
  clientLedger,
  clients,
  cargos,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { nextNumber } from "@/modules/shared/numbering";
import { toUsd, dateStr } from "./fx";
import { getActiveTariff } from "./service";
import { paymentSchema, type PaymentInput } from "./dto";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Tarifdan yuk narxini hisoblash ──────────────────────────────────────────

type Charge = {
  qty: number;
  unit: "kg" | "m3";
  rate: number;
  currency: string;
  amount: number;
};

async function chargeForCargo(
  clientId: string,
  cargo: { totalWeightKg: string; totalVolumeM3: string },
  on: Date,
): Promise<Charge | null> {
  // kg tarifi bo'lsa og'irlik bo'yicha, aks holda m³ bo'yicha.
  const kg = await getActiveTariff(clientId, "kg", on);
  const m3 = await getActiveTariff(clientId, "m3", on);
  const tariff = kg ?? m3;
  if (!tariff) return null;
  const qty =
    tariff.unit === "kg" ? Number(cargo.totalWeightKg) : Number(cargo.totalVolumeM3);
  const rate = Number(tariff.rate);
  return { qty, unit: tariff.unit, rate, currency: tariff.currency, amount: r2(qty * rate) };
}

/** Mijozning hali invoyslanmagan yuklari (hisoblangan narx bilan). */
export async function getInvoiceableCargos(clientId: string) {
  await requirePermission("finance.view");
  const invoiced = db
    .select({ cargoId: invoiceLines.cargoId })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
    .where(ne(invoices.status, "void"));

  const rows = await db
    .select({
      id: cargos.id,
      regNumber: cargos.regNumber,
      status: cargos.status,
      totalWeightKg: cargos.totalWeightKg,
      totalVolumeM3: cargos.totalVolumeM3,
      receivedAt: cargos.receivedAt,
    })
    .from(cargos)
    .where(
      and(
        eq(cargos.clientId, clientId),
        eq(cargos.voided, false),
        sql`${cargos.id} not in (${invoiced})`,
      ),
    )
    .orderBy(asc(cargos.receivedAt));

  const now = new Date();
  const out = [];
  for (const c of rows) {
    const charge = await chargeForCargo(clientId, c, now);
    out.push({
      cargoId: c.id,
      regNumber: c.regNumber,
      status: c.status,
      weightKg: Number(c.totalWeightKg),
      volumeM3: Number(c.totalVolumeM3),
      charge,
    });
  }
  return out;
}

/** Qoralama invoys: tanlangan yuklardan tarif bo'yicha qatorlar yaratadi. */
export async function createDraftInvoice(clientId: string, cargoIds: string[]) {
  const session = await requirePermission("finance.manage");
  if (cargoIds.length === 0) throw new Error("NO_CARGO");

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) throw new Error("CLIENT_NOT_FOUND");

  const cargoRows = await db
    .select()
    .from(cargos)
    .where(and(eq(cargos.clientId, clientId), inArray(cargos.id, cargoIds), eq(cargos.voided, false)));
  if (cargoRows.length === 0) throw new Error("NO_CARGO");

  const now = new Date();
  const lines: {
    cargoId: string;
    description: string;
    qty: string;
    unit: "kg" | "m3";
    rate: string;
    amount: string;
  }[] = [];
  let currency: string | null = null;
  let total = 0;
  for (const c of cargoRows) {
    const charge = await chargeForCargo(clientId, c, now);
    if (!charge) throw new Error("NO_TARIFF");
    if (currency && currency !== charge.currency) throw new Error("MIXED_CURRENCY");
    currency = charge.currency;
    total = r2(total + charge.amount);
    lines.push({
      cargoId: c.id,
      description: `${c.regNumber} · ${charge.qty} ${charge.unit === "kg" ? "kg" : "m³"}`,
      qty: String(charge.qty),
      unit: charge.unit,
      rate: String(charge.rate),
      amount: String(charge.amount),
    });
  }

  const number = await nextNumber("invoice", { year: true, pad: 5 });
  const invoice = await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoices)
      .values({
        number,
        clientId,
        currency: currency!,
        total: String(total),
        status: "draft",
        createdBy: session.sub,
      })
      .returning();
    await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv.id })));
    return inv;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "invoice",
    entityId: invoice.id,
    payload: { number, client: client.code, total, currency },
  });
  return invoice;
}

/** Joriy qoldiqdan keyingi balansni hisoblab, ledgerga yozadi (USD). */
async function postLedger(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  clientId: string,
  type: "charge" | "payment" | "adjustment",
  amountUsd: number,
  refType: string,
  refId: string,
  note?: string,
) {
  const [agg] = await tx
    .select({ s: sql<string>`coalesce(sum(${clientLedger.amountUsd}), 0)` })
    .from(clientLedger)
    .where(eq(clientLedger.clientId, clientId));
  const balanceAfter = r2(Number(agg.s) + amountUsd);
  await tx.insert(clientLedger).values({
    clientId,
    type,
    amountUsd: String(r2(amountUsd)),
    balanceAfterUsd: String(balanceAfter),
    refType,
    refId,
    note: note ?? null,
  });
  return balanceAfter;
}

/** Invoysni chiqarish: mijozga qarz yoziladi (ledger charge). */
export async function issueInvoice(invoiceId: string) {
  const session = await requirePermission("finance.manage");
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) throw new Error("NOT_FOUND");
  if (inv.status !== "draft") throw new Error("BAD_STATUS");

  const issuedAt = new Date();
  const due = new Date(issuedAt.getTime() + 15 * 86_400_000);
  const { amountUsd } = await toUsd(Number(inv.total), inv.currency, issuedAt);

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "issued", issuedAt, dueAt: dateStr(due), updatedAt: issuedAt })
      .where(eq(invoices.id, invoiceId));
    await postLedger(tx, inv.clientId, "charge", amountUsd, "invoice", inv.id, inv.number);
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "issue",
    entity: "invoice",
    entityId: inv.id,
    payload: { number: inv.number, amountUsd },
  });
}

export async function voidInvoice(invoiceId: string) {
  const session = await requirePermission("finance.manage");
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) throw new Error("NOT_FOUND");
  if (inv.status === "void") return;

  await db.transaction(async (tx) => {
    // Chiqarilgan bo'lsa — qarzni teskari yozamiz.
    if (inv.status !== "draft") {
      const { amountUsd } = await toUsd(Number(inv.total), inv.currency, new Date());
      await postLedger(tx, inv.clientId, "adjustment", -amountUsd, "invoice", inv.id, `void ${inv.number}`);
    }
    await tx.update(invoices).set({ status: "void", updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "void",
    entity: "invoice",
    entityId: inv.id,
    payload: { number: inv.number },
  });
}

// ─── To'lovlar ───────────────────────────────────────────────────────────────

export async function recordPayment(input: PaymentInput) {
  const session = await requirePermission("finance.manage");
  const data = paymentSchema.parse(input);
  const receivedAt = new Date();
  const { amountUsd, fxRateToUsd } = await toUsd(data.amount, data.currency, receivedAt);

  const payment = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(payments)
      .values({
        clientId: data.clientId,
        invoiceId: data.invoiceId || null,
        amount: String(data.amount),
        currency: data.currency,
        fxRateToUsd: String(fxRateToUsd),
        amountUsd: String(amountUsd),
        method: data.method,
        receivedBy: session.sub,
        note: data.note || null,
      })
      .returning();

    // To'lov qarzni kamaytiradi (manfiy ledger).
    await postLedger(tx, data.clientId, "payment", -amountUsd, "payment", p.id, data.method);

    // Invoysga bog'langan bo'lsa — to'langanlik holatini yangilaymiz.
    if (data.invoiceId) {
      const inv = await tx.query.invoices.findFirst({ where: eq(invoices.id, data.invoiceId) });
      if (inv && inv.status !== "void") {
        const [paidAgg] = await tx
          .select({ s: sql<string>`coalesce(sum(${payments.amountUsd}), 0)` })
          .from(payments)
          .where(eq(payments.invoiceId, data.invoiceId));
        const paidUsd = Number(paidAgg.s);
        const { amountUsd: totalUsd } = await toUsd(Number(inv.total), inv.currency, inv.issuedAt ?? receivedAt);
        const status = paidUsd + 0.01 >= totalUsd ? "paid" : "partially_paid";
        await tx.update(invoices).set({ status, updatedAt: receivedAt }).where(eq(invoices.id, data.invoiceId));
      }
    }
    return p;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "payment",
    entityId: payment.id,
    payload: { amount: data.amount, currency: data.currency, amountUsd, method: data.method },
  });
  return payment;
}

// ─── O'qish so'rovlari ───────────────────────────────────────────────────────

export async function listInvoices(filter: { status?: string } = {}) {
  await requirePermission("finance.view");
  const conds = [];
  if (filter.status) conds.push(eq(invoices.status, filter.status as "draft"));
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientCode: clients.code,
      clientName: clients.name,
      currency: invoices.currency,
      total: invoices.total,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(invoices.createdAt))
    .limit(200);
}

export async function getInvoice(id: string) {
  await requirePermission("finance.view");
  const inv = await db
    .select({
      invoice: invoices,
      clientCode: clients.code,
      clientName: clients.name,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!inv[0]) return null;
  const lines = await db.query.invoiceLines.findMany({
    where: eq(invoiceLines.invoiceId, id),
  });
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.receivedAt));
  return { ...inv[0], lines, payments: pays };
}

export async function getClientBalanceUsd(clientId: string): Promise<number> {
  const [agg] = await db
    .select({ s: sql<string>`coalesce(sum(${clientLedger.amountUsd}), 0)` })
    .from(clientLedger)
    .where(eq(clientLedger.clientId, clientId));
  return Number(agg.s);
}

/** Qarzdorlar: musbat balansli mijozlar + eng eski chiqarilgan invoys yoshi. */
export async function getDebtors() {
  await requirePermission("finance.view");
  const bal = await db
    .select({
      clientId: clientLedger.clientId,
      balance: sql<string>`sum(${clientLedger.amountUsd})`,
    })
    .from(clientLedger)
    .groupBy(clientLedger.clientId);

  const debtorIds = bal.filter((b) => Number(b.balance) > 0.01).map((b) => b.clientId);
  if (debtorIds.length === 0) return { rows: [], totalUsd: 0 };

  const clientRows = await db
    .select({ id: clients.id, code: clients.code, name: clients.name })
    .from(clients)
    .where(inArray(clients.id, debtorIds));
  const clientMap = new Map(clientRows.map((c) => [c.id, c]));

  // Eng eski to'lanmagan invoys (aging uchun):
  const oldest = await db
    .select({
      clientId: invoices.clientId,
      issuedAt: sql<string>`min(${invoices.issuedAt})`,
    })
    .from(invoices)
    .where(and(inArray(invoices.clientId, debtorIds), inArray(invoices.status, ["issued", "partially_paid"])))
    .groupBy(invoices.clientId);
  const oldestMap = new Map(oldest.map((o) => [o.clientId, o.issuedAt]));

  const now = Date.now();
  const rows = bal
    .filter((b) => Number(b.balance) > 0.01)
    .map((b) => {
      const c = clientMap.get(b.clientId)!;
      const iso = oldestMap.get(b.clientId);
      const days = iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : 0;
      return {
        clientId: b.clientId,
        code: c.code,
        name: c.name,
        balanceUsd: r2(Number(b.balance)),
        oldestDays: days,
      };
    })
    .sort((a, b) => b.balanceUsd - a.balanceUsd);

  const totalUsd = r2(rows.reduce((s, r) => s + r.balanceUsd, 0));
  return { rows, totalUsd };
}
