import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RootPageClient from "@/components/RootPageClient";
import { resolvePlatformFromHost } from "@/lib/platform";

export default async function Home() {
  const host = (await headers()).get("host");
  const { platform, isMatchedSubdomain } = resolvePlatformFromHost(host);

  if (isMatchedSubdomain) {
    redirect(platform.publicEntryPath);
  }

  return <RootPageClient />;
}
