'use client'
export const dynamic = "force-dynamic";

import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
    return (
        <div className="flex flex-row h-screen">
            <div className="w-full md:w-full xl:w-[600px] md:max-w-[600px] flex flex-col items-center content-center justify-center overflow-y-scroll">
                
                <div className="flex flex-row border-b border-gray-200 pb-4 max-w-[300px] items-center">
                    <div>
                        <img src="/logo.png" alt="" />
                    </div>
                    <div className="flex-1 whitespace-nowrap text-3xl">
                        Oracle Games
                    </div>
                </div>
                <div className="flex flex-col items-center mt-4">
                    <span className="font-bold">Welcome back!</span>
                    <span className="font-light">Log in with your details</span>
                </div>

                <div className="my-4 w-[300px]">
                    <LoginForm />
                </div>


            </div>
            <div className="w-0 md:flex-1">
                <img src="/homepage_picture_5.jpg" className="w-full h-full object-cover object-[25%_50%]" alt="" />
            </div>
        </div>
    );
}