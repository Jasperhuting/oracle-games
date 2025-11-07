import { ResetPasswordForm } from "@/components/ResetPasswordForm";

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
                    <span className="font-bold">Wachtwoord vergeten?</span>
                    <span className="font-light text-sm text-gray-600 text-center max-w-[300px] mt-2">
                        Geen probleem! Vul je e-mailadres in en we sturen je een link om je wachtwoord opnieuw in te stellen.
                    </span>
                </div>

                <div className="my-4">
                    <ResetPasswordForm />
                </div>

            </div>
            <div className="w-0 md:flex-1 bg-red-500">
                rechterkant
            </div>
        </div>
    );
}
