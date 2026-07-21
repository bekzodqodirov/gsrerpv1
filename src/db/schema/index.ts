// Barcha modul sxemalari shu yerdan eksport qilinadi.
// Har bir modul o'z sxema faylini shu papkaga qo'shadi:
//   system.ts    — user, role, permission, audit_log (0-bosqich)
//   catalog.ts   — client, warehouse, product_type, currency (1-bosqich)
//   cargo.ts     — cargo, cargo_event: yuk hayot tsikli (2-bosqich)
//   trips.ts     — truck_trip, trip_cargo: yollanma mashinalar (2-bosqich)
//   finance.ts   — invoice, payment, expense, client_ledger (4-bosqich)
//   hr.ts        — employee, attendance, payroll (5-bosqich)

export * from "./system";
export * from "./catalog";
export * from "./cargo";
