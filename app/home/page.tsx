import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePlatformFromHost } from "@/lib/platform";

export default async function HomePage() {
    const host = (await headers()).get("host");
    const { platform, isMatchedSubdomain } = resolvePlatformFromHost(host);

    redirect(isMatchedSubdomain ? platform.authenticatedEntryPath : '/account');
}
