import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// .env.local (bo'lmasa .env) dan o'qiymiz — db:migrate/db:generate ni
// qo'shimcha sozlashsiz ishlatish uchun (Windows/mac/Linux bir xil).
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
