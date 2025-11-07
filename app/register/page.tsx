import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
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
                <div className="flex flex-col items-center mt-4">
                    <span className="font-bold">Welkom bij Oracle Games</span>
                    <span className="font-light">Vul je gegevens in</span>
                </div>

                <div className="my-4 w-[300px]">
                    <RegisterForm />
                </div>


            </div>
            <div className="w-0 md:flex-1 bg-red-500">
                rechterkant
            </div>
        </div>
    );
}