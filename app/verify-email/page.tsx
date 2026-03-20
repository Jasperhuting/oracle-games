import { headers } from "next/headers";
import VerifyEmailPageClient from "@/components/VerifyEmailPageClient";
import { resolvePlatformFromHost } from "@/lib/platform";

export default async function VerifyEmailPage() {
    const host = (await headers()).get("host");
    const { platform } = resolvePlatformFromHost(host);

    return <VerifyEmailPageClient heroImageSrc={platform.authImages.verifyEmail} />;
}
