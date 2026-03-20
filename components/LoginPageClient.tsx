'use client'

import { LoginForm } from "@/components/LoginForm";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function LoginPageClient({
    previewHref = "/preview",
    heroImageSrc = "/homepage_picture_5.jpg",
}: {
    previewHref?: string;
    heroImageSrc?: string;
}) {
    const { t } = useTranslation();
    return (
        <div className="relative min-h-screen overflow-hidden">
            <Image
                src={heroImageSrc}
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
                    <div className="mt-4 flex flex-col items-center text-center">
                        <span className="font-bold text-slate-900">{t('login.title')}</span>
                        <span className="font-light text-slate-600">{t('login.description')}</span>
                    </div>
                    <div className="mt-3 text-center text-sm text-slate-600">
                        Wil je eerst even zien wat de website is?{" "}
                        <Link href={previewHref} className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
                            Bekijk dan de previewpagina
                        </Link>
                        .
                    </div>

                    <div className="mt-5">
                        <LoginForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
