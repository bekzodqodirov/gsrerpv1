-- Yukni qaytarish: yangi 'returned' holati (ombordan chiqadi, qoldiqqa kirmaydi).
ALTER TYPE "public"."cargo_status" ADD VALUE IF NOT EXISTS 'returned';
