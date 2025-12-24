'use client'
import { RegisterForm } from "@/components/RegisterForm";
import Image from 'next/image';
import { useTranslation } from "react-i18next";

export default function RegisterPageClient() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-row h-screen">
            <div className="w-full md:w-full xl:w-[600px] md:max-w-[600px] flex flex-col items-center content-center justify-center">

                <div className="flex flex-row border-b border-gray-200 pb-4 max-w-[300px] items-center">
                    <div>
                        <Image src="/logo.png" alt="Oracle Games Logo" width={56} height={56} priority />
                    </div>
                    <div className="flex-1 whitespace-nowrap text-3xl">
                        Oracle Games
                    </div>
                </div>
                <div className="flex flex-col items-center mt-4">
                    <span className="font-bold">{t('register.title')}</span>
                    <span className="font-light">{t('register.description')}</span>
                </div>

                <div className="my-4 w-[300px]">
                    <RegisterForm />
                </div>


            </div>
            <div className="w-0 md:flex-1 relative">
                <Image
                    src="/homepage_picture_1.jpg"
                    alt="Oracle Games"
                    width={1920}
                    height={1080}
                    fill
                    className="object-cover object-[25%_50%]"
                    priority
                />
            </div>
        </div>
    );
}
