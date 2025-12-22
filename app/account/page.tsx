import { AuthGuard } from "@/components/AuthGuard";
import { AccountPageContent } from "@/components/AccountPageContent";

export default function AccountPage() {
    return (
        <AuthGuard>
            <AccountPageContent />
        </AuthGuard>
    );
}
