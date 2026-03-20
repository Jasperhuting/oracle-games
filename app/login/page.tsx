export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import LoginPageClient from "@/components/LoginPageClient";
import { resolvePlatformFromHost } from "@/lib/platform";

export default async function LoginPage() {
    const host = (await headers()).get("host");
    const { platform, isMatchedSubdomain } = resolvePlatformFromHost(host);

    return (
        <LoginPageClient
            previewHref={isMatchedSubdomain ? platform.publicEntryPath : "/preview"}
            heroImageSrc={platform.authImages.login}
        />
    );
}
