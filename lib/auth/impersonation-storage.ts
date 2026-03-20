"use client";

import { getSharedCookieDomain } from "./session-cookie";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

function setCookieValue(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;

  const domain = getSharedCookieDomain(window.location.hostname);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; Domain=${domain}` : "";

  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${domainPart}${secure}`;
}

function deleteCookieValue(name: string) {
  if (typeof document === "undefined") return;

  const domain = getSharedCookieDomain(window.location.hostname);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; Domain=${domain}` : "";

  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domainPart}${secure}`;
}

export function setImpersonationCustomToken(token: string) {
  localStorage.setItem("impersonation_token", token);
  setCookieValue("impersonation_token", token, 60 * 30);
}

export function getImpersonationCustomToken() {
  return localStorage.getItem("impersonation_token") || getCookieValue("impersonation_token");
}

export function clearImpersonationCustomToken() {
  localStorage.removeItem("impersonation_token");
  deleteCookieValue("impersonation_token");
}

export function setAdminRestoreToken(token: string) {
  localStorage.setItem("admin_restore_token", token);
  setCookieValue("admin_restore_token", token, 60 * 30);
}

export function getAdminRestoreToken() {
  return localStorage.getItem("admin_restore_token") || getCookieValue("admin_restore_token");
}

export function clearAdminRestoreToken() {
  localStorage.removeItem("admin_restore_token");
  deleteCookieValue("admin_restore_token");
}

export function setRestoreAdminSessionToken(token: string) {
  localStorage.setItem("restore_admin_session", token);
  setCookieValue("restore_admin_session", token, 60 * 10);
}

export function getRestoreAdminSessionToken() {
  return localStorage.getItem("restore_admin_session") || getCookieValue("restore_admin_session");
}

export function clearRestoreAdminSessionToken() {
  localStorage.removeItem("restore_admin_session");
  deleteCookieValue("restore_admin_session");
}

export function clearAllImpersonationClientState() {
  localStorage.removeItem("impersonation");
  clearImpersonationCustomToken();
  clearAdminRestoreToken();
  clearRestoreAdminSessionToken();
}
