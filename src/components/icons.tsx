// Inline SVG ikonkalar (lucide uslubida, 24×24, stroke).
import * as React from "react";

function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const icons = {
  dashboard: (c?: string) => (
    <Icon className={c}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  cargo: (c?: string) => (
    <Icon className={c}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3.3 8.3L12 13l8.7-4.7" />
      <path d="M12 13v9" />
    </Icon>
  ),
  clients: (c?: string) => (
    <Icon className={c}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <circle cx="17.5" cy="9.5" r="2.5" />
      <path d="M21.5 19c-.5-2.2-2-3.7-4.2-4.1" />
    </Icon>
  ),
  finance: (c?: string) => (
    <Icon className={c}>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6.5 15h4" />
    </Icon>
  ),
  hr: (c?: string) => (
    <Icon className={c}>
      <rect x="4" y="6" width="16" height="15" rx="2" />
      <path d="M9 6V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V6" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.5 18.5c.7-1.9 2.4-3 4.5-3s3.8 1.1 4.5 3" />
    </Icon>
  ),
  settings: (c?: string) => (
    <Icon className={c}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.09a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55h.09a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.09a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" />
    </Icon>
  ),
  logout: (c?: string) => (
    <Icon className={c}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  ),
  menu: (c?: string) => (
    <Icon className={c}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  ),
  close: (c?: string) => (
    <Icon className={c}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  ),
  search: (c?: string) => (
    <Icon className={c}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  ),
  printer: (c?: string) => (
    <Icon className={c}>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <path d="M7 14h10v7H7z" />
    </Icon>
  ),
  qr: (c?: string) => (
    <Icon className={c}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z" />
    </Icon>
  ),
} as const;

export type IconName = keyof typeof icons;
