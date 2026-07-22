"use client";

// Jonli yangilanish: 5-6 ishchi birga scan qilganda skladchi/logist sahifasi
// o'z-o'zidan yangilanib turadi (websocketsiz, yengil polling).
import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";

export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
