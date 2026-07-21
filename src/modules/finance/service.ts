// Moliya servisi: valyuta kurslari va mijoz tariflari (shu bosqichda).
// Invoys/to'lov/xarajat keyingi fayllarda shu modulga qo'shiladi.
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exchangeRates,
  clientTariffs,
  clients,
  auditLog,
} from "@/db/schema";
import { requirePermission } from "@/modules/shared/auth";
import { dateStr } from "./fx";
import {
  exchangeRateSchema,
  clientTariffSchema,
  type ExchangeRateInput,
  type ClientTariffInput,
} from "./dto";

// ─── Valyuta kurslari ────────────────────────────────────────────────────────

export async function listExchangeRates() {
  await requirePermission("finance.view");
  return db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.rateDate), asc(exchangeRates.currency))
    .limit(100);
}

/** Har valyutaning eng oxirgi kursi (hublar/formalar uchun). */
export async function latestRates() {
  await requirePermission("finance.view");
  const rows = await db
    .select({
      currency: exchangeRates.currency,
      rate: exchangeRates.rateToUsd,
      rateDate: exchangeRates.rateDate,
    })
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.rateDate));
  const seen = new Map<string, { rate: string; rateDate: string }>();
  for (const r of rows) {
    if (!seen.has(r.currency)) seen.set(r.currency, { rate: r.rate, rateDate: r.rateDate });
  }
  return seen;
}

export async function createExchangeRate(input: ExchangeRateInput) {
  const session = await requirePermission("finance.manage");
  const data = exchangeRateSchema.parse(input);
  const [row] = await db
    .insert(exchangeRates)
    .values({
      currency: data.currency,
      rateToUsd: String(data.rateToUsd),
      rateDate: data.rateDate,
    })
    .returning();
  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "exchange_rate",
    entityId: row.id,
    payload: { currency: data.currency, rate: data.rateToUsd, date: data.rateDate },
  });
  return row;
}

// ─── Mijoz tariflari ─────────────────────────────────────────────────────────

export async function listClientTariffs() {
  await requirePermission("finance.view");
  return db
    .select({
      id: clientTariffs.id,
      clientCode: clients.code,
      clientName: clients.name,
      unit: clientTariffs.unit,
      rate: clientTariffs.rate,
      currency: clientTariffs.currency,
      validFrom: clientTariffs.validFrom,
      validTo: clientTariffs.validTo,
      note: clientTariffs.note,
    })
    .from(clientTariffs)
    .innerJoin(clients, eq(clientTariffs.clientId, clients.id))
    .orderBy(asc(clients.code), asc(clientTariffs.unit), desc(clientTariffs.validFrom))
    .limit(500);
}

/** Mijoz+birlik uchun berilgan sanada amaldagi tarif (invoyslash uchun). */
export async function getActiveTariff(
  clientId: string,
  unit: "kg" | "m3",
  on: Date = new Date(),
) {
  const day = dateStr(on);
  const rows = await db
    .select()
    .from(clientTariffs)
    .where(
      and(
        eq(clientTariffs.clientId, clientId),
        eq(clientTariffs.unit, unit),
        lte(clientTariffs.validFrom, day),
        or(isNull(clientTariffs.validTo), gt(clientTariffs.validTo, day)),
      ),
    )
    .orderBy(desc(clientTariffs.validFrom))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Yangi tarif — o'sha mijoz+birlikning avvalgi amaldagi tarifini yopadi
 * (validTo = yangi validFrom), so'ng yangisini qo'shadi. Tarix saqlanadi.
 */
export async function createClientTariff(input: ClientTariffInput) {
  const session = await requirePermission("finance.manage");
  const data = clientTariffSchema.parse(input);

  const row = await db.transaction(async (tx) => {
    await tx
      .update(clientTariffs)
      .set({ validTo: data.validFrom })
      .where(
        and(
          eq(clientTariffs.clientId, data.clientId),
          eq(clientTariffs.unit, data.unit),
          isNull(clientTariffs.validTo),
        ),
      );
    const [r] = await tx
      .insert(clientTariffs)
      .values({
        clientId: data.clientId,
        unit: data.unit,
        rate: String(data.rate),
        currency: data.currency,
        validFrom: data.validFrom,
        note: data.note || null,
        createdBy: session.sub,
      })
      .returning();
    return r;
  });

  await db.insert(auditLog).values({
    userId: session.sub,
    action: "create",
    entity: "client_tariff",
    entityId: row.id,
    payload: { unit: data.unit, rate: data.rate, currency: data.currency },
  });
  return row;
}

export async function getFinanceClients() {
  await requirePermission("finance.view");
  return db
    .select({ id: clients.id, code: clients.code, name: clients.name })
    .from(clients)
    .where(eq(clients.isActive, true))
    .orderBy(asc(clients.code));
}

/** Hub uchun: qisqa moliya ko'rsatkichlari (keyingi bosqichlarda kengayadi). */
export async function financeCounts() {
  await requirePermission("finance.view");
  const [tariffs] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clientTariffs)
    .where(isNull(clientTariffs.validTo));
  return { activeTariffs: tariffs?.n ?? 0 };
}
