import { headers } from "next/headers";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { resolvePlatformFromHost } from "@/lib/platform";
import { t } from "i18next";
import Image from 'next/image';


export default async function ResetPasswordPage() {
    const host = (await headers()).get("host");
    const { platform } = resolvePlatformFromHost(host);

    return (
        <div className="relative min-h-screen overflow-hidden">
            <Image 
                src={platform.authImages.resetPassword} 
                alt="Oracle Games" 
                fill
                className="object-cover object-center"
                priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.42),rgba(3,7,18,0.58))]" />
            <div className="relative z-10 flex min-h-screen items-center justify-center overflow-y-auto px-6 py-10">
                <div className="w-full max-w-[420px] rounded-[28px] border border-white/65 bg-white/88 px-8 py-10 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur">
                    <div className="flex flex-row items-center border-b border-slate-200 pb-4">
                        <div>
                            <Image src="/logo.png" alt="Oracle Games Logo" width={56} height={56} priority />
                        </div>
                        <div className="flex-1 whitespace-nowrap text-3xl font-medium text-slate-900">
                            Oracle Games
                        </div>
                    </div>
                    
                    <div className="mt-4 mb-6 flex flex-col items-center text-center">
                        <span className="font-bold text-slate-900">{t('resetPassword.title')}</span>
                        <span className="mt-2 max-w-[320px] text-sm font-light text-slate-600">
                            {t('resetPassword.description')}
                        </span>
                    </div>

                    <div>
                        <ResetPasswordForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
