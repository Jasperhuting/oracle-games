import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import Image from 'next/image';

export default function ResetPasswordPage() {
    return (
        <div className="flex flex-row h-screen">
            <div className="w-full md:w-full xl:w-[600px] md:max-w-[600px] flex flex-col items-center content-center justify-center">
                
                <div className="flex flex-row border-b border-gray-200 pb-4 max-w-[300px] items-center">
                    <div>
                        <img src="/logo.png" alt="" />
                    </div>
                    <div className="flex-1 whitespace-nowrap text-3xl">
                        Oracle Games
                    </div>
                </div>
                
                <div className="flex flex-col items-center mt-4 mb-6">
                    <span className="font-bold">Forget password?</span>
                    <span className="font-light text-sm text-gray-600 text-center max-w-[300px] mt-2">
                        No problem! Enter your email address and we will send you a link to reset your password.
                    </span>
                </div>

                <div className="my-4">
                    <ResetPasswordForm />
                </div>

            </div>
            <div className="w-0 md:flex-1">
                <img src="/homepage_picture_3.jpg" className="w-full h-full object-cover object-[25%_50%]" alt="" />
            </div>
        </div>
    );
}
