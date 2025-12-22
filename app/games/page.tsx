import { JoinableGamesTab } from "@/components/JoinableGamesTab";
import { AuthGuard } from "@/components/AuthGuard";
import { GamesBreadcrumb } from "@/components/GamesBreadcrumb";

export default function GamesPage() {
    return (
        <AuthGuard>
            <div className="flex flex-col min-h-screen p-8 bg-gray-50">
                <div className="mx-auto container">
                    <GamesBreadcrumb />
                    <JoinableGamesTab />
                </div>
            </div>
        </AuthGuard>
    );
}
