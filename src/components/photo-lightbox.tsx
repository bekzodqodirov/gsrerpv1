"use client";

// Rasm galereyasi + lightbox: rasmga bosilganda YANGI TAB emas, shu sahifa
// ustida alohida oynada (overlay) ochiladi. Bir nechta rasm bo'lsa — o'q
// tugmalari bilan varaqlash, Esc bilan yopish.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { icons } from "@/components/icons";

export type Photo = { id: string; name?: string };

export function PhotoThumbs({
  photos,
  thumbClass = "h-11 w-11",
  emptyDash = true,
}: {
  photos: Photo[];
  thumbClass?: string;
  emptyDash?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return emptyDash ? <span className="text-muted">—</span> : null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIdx(i);
            }}
            className={`block overflow-hidden rounded-lg border border-line transition-transform hover:scale-105 ${thumbClass}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${p.id}`}
              alt={p.name ?? ""}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      {openIdx !== null && (
        <Lightbox
          photos={photos}
          index={openIdx}
          onIndex={setOpenIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const many = photos.length > 1;
  const prev = useCallback(
    () => onIndex((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndex],
  );
  const next = useCallback(
    () => onIndex((index + 1) % photos.length),
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && many) prev();
      else if (e.key === "ArrowRight" && many) next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [many, prev, next, onClose]);

  if (typeof document === "undefined") return null;
  const cur = photos[index];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="close"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        {icons.close("h-5 w-5")}
      </button>

      {many && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="previous"
          className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
        >
          ‹
        </button>
      )}

      <figure
        className="flex max-h-full max-w-full flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${cur.id}`}
          alt={cur.name ?? ""}
          className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        {(cur.name || many) && (
          <figcaption className="mt-3 text-center text-sm text-white/80">
            {cur.name}
            {many && (
              <span className="ml-2 text-white/50">
                {index + 1}/{photos.length}
              </span>
            )}
          </figcaption>
        )}
      </figure>

      {many && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="next"
          className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
        >
          ›
        </button>
      )}
    </div>,
    document.body,
  );
}
