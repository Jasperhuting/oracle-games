import { getAdminProfile as getAdminProfileFromRepository } from "@/lib/stats/repository";

export async function getAdminProfile(uid: string) {
  return getAdminProfileFromRepository(uid);
}
