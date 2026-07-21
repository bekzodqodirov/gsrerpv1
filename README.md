# GSR ERP

Korxona boshqaruv tizimi: ombor, savdo (CRM), moliya va HR — bitta ilovada.

## Texnologiyalar

- **Next.js** (App Router) + TypeScript
- **PostgreSQL 16** + Drizzle ORM
- **next-intl** — 4 til: o'zbek (asosiy), rus, ingliz, xitoy
- Tailwind CSS

## Ishga tushirish (dev)

**Talablar:** Node.js 20+ va Docker (Postgres uchun) — Docker Desktop **ishga tushgan** bo'lishi shart.

```bash
# 1. Bog'liqliklar
npm install

# 2. Muhit o'zgaruvchilari
cp .env.example .env.local        # Windows (cmd): copy .env.example .env.local
#    .env.local dagi AUTH_SECRET ni haqiqiy uzun satrga o'zgartiring

# 3. Ma'lumotlar bazasi (Docker Desktop ishga tushgan bo'lsin)
docker compose up -d

# 4. Migratsiyalar (SQL allaqachon repo'da — db:generate SHART EMAS)
npm run db:migrate

# 5. Seed: admin, rollar, huquqlar, omborlar, mashinalar
npm run db:seed
npm run db:seed:demo              # (ixtiyoriy) namuna mijoz + yuklar — ekranlar to'ldiriladi

# 6. Server
npm run dev                       # http://localhost:3000  (kirish: admin / admin123)
```

> Docker bo'lmasa: istalgan Postgres 16'ni ishlatib, `.env.local` dagi
> `DATABASE_URL` ni o'shanga moslang. `db:migrate`/`db:seed` `.env.local` ni
> avtomatik o'qiydi.

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
