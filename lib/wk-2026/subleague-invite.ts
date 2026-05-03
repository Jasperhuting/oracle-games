"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";

const STORAGE_KEY = "wk2026PendingSubLeagueCode";
export const WK_2026_SUBLEAGUE_QUERY_PARAM = "subleague";

function normalizeInviteCode(value: string | null | undefined): string | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized.length >= 4 ? normalized : null;
}

export function getInviteCodeFromSearchParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParams | null | undefined,
): string | null {
  if (!searchParams) {
    return null;
  }

  return normalizeInviteCode(searchParams.get(WK_2026_SUBLEAGUE_QUERY_PARAM));
}

export function persistPendingInviteCode(code: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeInviteCode(code);

  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export function getPendingInviteCode() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeInviteCode(window.localStorage.getItem(STORAGE_KEY));
}

export function clearPendingInviteCode() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function getWk2026InviteRedirectPath(fallbackPath: string) {
  const code = getPendingInviteCode();

  if (!code) {
    return fallbackPath;
  }

  return `/wk-2026/standings?${WK_2026_SUBLEAGUE_QUERY_PARAM}=${encodeURIComponent(code)}`;
}

export function buildWk2026RegisterInviteUrl(code: string) {
  const normalized = normalizeInviteCode(code);

  if (!normalized) {
    return "/register";
  }

  return `/register?${WK_2026_SUBLEAGUE_QUERY_PARAM}=${encodeURIComponent(normalized)}`;
}

export function buildPathWithInviteCode(path: string, code: string | null) {
  const normalized = normalizeInviteCode(code);

  if (!normalized) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${WK_2026_SUBLEAGUE_QUERY_PARAM}=${encodeURIComponent(normalized)}`;
}
