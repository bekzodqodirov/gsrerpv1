-- Sklad qisqa kodlari (stikerda): GS1..GS6 → YW/GZ/URM/KSH (UZ: TSH/ADN).
UPDATE "warehouse" SET "gs_code" = 'YW'  WHERE "code" = 'YIWU';--> statement-breakpoint
UPDATE "warehouse" SET "gs_code" = 'GZ'  WHERE "code" = 'GZ';--> statement-breakpoint
UPDATE "warehouse" SET "gs_code" = 'URM' WHERE "code" = 'URC';--> statement-breakpoint
UPDATE "warehouse" SET "gs_code" = 'KSH' WHERE "code" = 'KSG';--> statement-breakpoint
UPDATE "warehouse" SET "gs_code" = 'TSH' WHERE "code" = 'TAS';--> statement-breakpoint
UPDATE "warehouse" SET "gs_code" = 'ADN' WHERE "code" = 'AND';
