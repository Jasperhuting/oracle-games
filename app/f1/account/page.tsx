import { AuthGuard } from "@/components/AuthGuard";
import { AccountPageContent } from "@/components/AccountPageContent";

export default function F1AccountPage() {
    return (
        <AuthGuard>
            <AccountPageContent />
        </AuthGuard>
    );
}
