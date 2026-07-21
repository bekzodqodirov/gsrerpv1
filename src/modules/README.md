# Modullar

Biznes-mantiq shu yerda yashaydi — UI (`src/app`) faqat shu qatlamni chaqiradi.

## Qoidalar

1. Har bir modul o'z papkasida: `inventory/`, `sales/`, `finance/`, `hr/`, `shared/`.
2. Modul tarkibi:
   - `service.ts` — biznes-amallar (hujjat o'tkazish, hisob-kitob). Faqat shu fayl tashqariga ochiq.
   - `dto.ts` — Zod sxemalari (kirish/chiqish validatsiyasi).
   - `queries.ts` — o'qish so'rovlari (ro'yxat, hisobot).
3. Bir modul boshqa modulning **jadvaliga to'g'ridan-to'g'ri tegmaydi** — faqat `service` orqali.
4. Huquq tekshiruvi (`rbac`) har doim service qatlamida, UI'dagi yashirish faqat qulaylik.
5. Pul — `numeric(18,4)`. `float` ishlatish taqiqlanadi.
6. Hujjatlar o'chirilmaydi — `voided` holatiga o'tkaziladi va `audit_log`ga yoziladi.
