import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import Image from 'next/image';
import { useTranslation } from "react-i18next";

export default function ResetPasswordPage() {
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
                
                <div className="flex flex-col items-center mt-4 mb-6">
                    <span className="font-bold">{t('resetPassword.title')}</span>
                    <span className="font-light text-sm text-gray-600 text-center max-w-[300px] mt-2">
                        {t('resetPassword.description')}
                    </span>
                </div>

                <div className="my-4">
                    <ResetPasswordForm />
                </div>

            </div>
            <div className="w-0 md:flex-1 relative">
                <Image 
                    src="/homepage_picture_2.jpg" 
                    alt="Oracle Games" 
                    fill
                    className="object-cover object-[25%_50%]"
                    priority
                />
            </div>
        </div>
    );
}
