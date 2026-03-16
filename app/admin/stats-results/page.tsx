import { StatsAdminGuard } from "@/components/admin/StatsAdminGuard";
import { StatsResultsClient } from "@/components/admin/stats/StatsResultsClient";

export default function StatsResultsPage() {
  return (
    <StatsAdminGuard>
      <StatsResultsClient />
    </StatsAdminGuard>
  );
}
