import { headers } from "next/headers";
import RegisterPageClient from "@/components/RegisterPageClient";
import { resolvePlatformFromHost } from "@/lib/platform";

export default async function RegisterPage() {
    const host = (await headers()).get("host");
    const { platform, isMatchedSubdomain } = resolvePlatformFromHost(host);

    return (
        <RegisterPageClient
            previewHref={isMatchedSubdomain ? platform.publicEntryPath : "/preview"}
            heroImageSrc={platform.authImages.register}
        />
    );
}
