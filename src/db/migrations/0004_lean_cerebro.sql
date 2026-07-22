ALTER TABLE "client" ADD COLUMN "last_letter_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "data" "bytea";--> statement-breakpoint
ALTER TABLE "cargo_line" ADD COLUMN "letter_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: mavjud qatorlarga mijoz bo'yicha UZLUKSIZ harf tartibini beramiz
-- (qabul sanasi, so'ng qator tartibi bo'yicha). Shu bilan eski yuklar ham
-- A, B, C ... tarzida davomiy harflarga ega bo'ladi.
UPDATE "cargo_line" cl
SET "letter_seq" = sub.seq
FROM (
  SELECT cl2.id AS id,
    (row_number() OVER (
      PARTITION BY c.client_id
      ORDER BY c.received_at, c.created_at, cl2.line_no
    ) - 1) AS seq
  FROM "cargo_line" cl2
  JOIN "cargo" c ON c.id = cl2.cargo_id
) sub
WHERE cl."id" = sub.id;--> statement-breakpoint
-- letter_code ni letter_seq dan qayta hisoblaymiz (0→A, 25→Z, 26→AA ...).
UPDATE "cargo_line"
SET "letter_code" = CASE
  WHEN ("letter_seq" % 702) < 26
    THEN chr(65 + ("letter_seq" % 702))
  ELSE chr(65 + ((("letter_seq" % 702) - 26) / 26))
       || chr(65 + ((("letter_seq" % 702) - 26) % 26))
END;--> statement-breakpoint
-- Har mijozning hisoblagichi = unga berilgan qatorlar soni (keyingi harf shundan).
UPDATE "client" cli
SET "last_letter_seq" = sub.cnt
FROM (
  SELECT c.client_id AS client_id, count(*)::int AS cnt
  FROM "cargo_line" cl
  JOIN "cargo" c ON c.id = cl.cargo_id
  GROUP BY c.client_id
) sub
WHERE cli."id" = sub.client_id;