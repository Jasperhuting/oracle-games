import { AuthGuard } from "@/components/AuthGuard";
import { AccountPageContent } from "@/components/AccountPageContent";

export default function FootballAccountPage() {
    return (
        <AuthGuard>
            <AccountPageContent />
        </AuthGuard>
    );
}
