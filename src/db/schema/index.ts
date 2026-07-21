// Barcha modul sxemalari shu yerdan eksport qilinadi.
// Har bir modul o'z sxema faylini shu papkaga qo'shadi:
//   system.ts    — user, role, permission, audit_log (0-bosqich)
//   catalog.ts   — product, category, unit, warehouse, partner (1-bosqich)
//   inventory.ts — stock_movement, inventory_count (2-bosqich)
//   sales.ts     — sales_order, invoice, price_list (3-bosqich)
//   finance.ts   — account, ledger_entry, payment (4-bosqich)
//   hr.ts        — employee, attendance, payroll (5-bosqich)

export * from "./system";
