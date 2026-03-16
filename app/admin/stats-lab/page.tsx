import { StatsAdminGuard } from "@/components/admin/StatsAdminGuard";
import { StatsLabClient } from "@/components/admin/stats/StatsLabClient";

export default function StatsLabPage() {
  return (
    <StatsAdminGuard>
      <StatsLabClient />
    </StatsAdminGuard>
  );
}
