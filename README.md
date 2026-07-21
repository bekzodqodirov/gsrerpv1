# GSR ERP

Korxona boshqaruv tizimi: ombor, savdo (CRM), moliya va HR — bitta ilovada.

## Texnologiyalar

- **Next.js** (App Router) + TypeScript
- **PostgreSQL 16** + Drizzle ORM
- **next-intl** — 4 til: o'zbek (asosiy), rus, ingliz, xitoy
- Tailwind CSS

## Ishga tushirish (dev)

```bash
# 1. Bog'liqliklar
npm install

# 2. Muhit o'zgaruvchilari
cp .env.example .env.local

# 3. Ma'lumotlar bazasi (Docker kerak)
docker compose up -d

# 4. Migratsiyalar
npm run db:generate   # sxemadan SQL yaratish
npm run db:migrate    # bazaga qo'llash

# 5. Server
npm run dev           # http://localhost:3000
```

## Struktura

```
src/
├── app/[locale]/     UI sahifalar (uz | ru | en | zh)
├── modules/          biznes-mantiq (service/dto/queries) — qoidalar: src/modules/README.md
├── db/schema/        Drizzle jadvallari (modul bo'yicha fayllar)
└── i18n/             til sozlamalari
messages/             tarjima fayllari
```

## Bosqichlar

| # | Bosqich | Holat |
|---|---------|-------|
| 0 | Poydevor: skelet, i18n, DB, RBAC sxemasi | 🔨 jarayonda |
| 1 | Ma'lumotnomalar (mahsulot, ombor, kontragent) | ⬜ |
| 2 | Ombor (kirim/chiqim/qoldiq) | ⬜ |
| 3 | Savdo va CRM | ⬜ |
| 4 | Moliya | ⬜ |
| 5 | HR | ⬜ |
| 6 | Hisobotlar | ⬜ |
