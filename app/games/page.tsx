import { JoinableGamesTab } from "@/components/JoinableGamesTab";
import { AuthGuard } from "@/components/AuthGuard";
import { GamesBreadcrumb } from "@/components/GamesBreadcrumb";

export default function GamesPage() {
    return (
        <AuthGuard>
            <div>
                <div className="relative z-10 flex flex-col min-h-screen px-6 py-8 mt-9">
                    <div className="mx-auto container">
                        <GamesBreadcrumb />
                        <div className="mt-4 mb-6 flex flex-col gap-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80">Oracle Games</p>
                            <h1 className="text-3xl sm:text-4xl font-semibold font-serif text-gray-900">
                                Games overzicht
                            </h1>
                            <p className="text-sm text-gray-600 max-w-2xl">
                                Kies je game, check deadlines en duik meteen in de competitie.
                            </p>
                        </div>
                        <JoinableGamesTab />
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
