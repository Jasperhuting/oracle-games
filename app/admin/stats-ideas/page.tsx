import { StatsAdminGuard } from "@/components/admin/StatsAdminGuard";
import { StatsIdeasClient } from "@/components/admin/stats/StatsIdeasClient";

export default function StatsIdeasPage() {
  return (
    <StatsAdminGuard>
      <StatsIdeasClient />
    </StatsAdminGuard>
  );
}
