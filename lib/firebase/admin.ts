import { adminAuth, adminDb, getServerAuth, getServerFirebase } from "@/lib/firebase/server";

export function getAdminDb() {
  return getServerFirebase();
}

export function getAdminAuth() {
  return getServerAuth();
}

export { adminDb, adminAuth };
