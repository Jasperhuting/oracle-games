import { AuthGuard } from "@/components/AuthGuard";
import { HomePageContent } from "@/components/HomePageContent";

export default function HomePage() {
    return (
        <AuthGuard>
            <HomePageContent />
        </AuthGuard>
    );
}
