import { loadEnvConfig } from "@next/env";
import { refreshAllWkTeamHistories } from "@/lib/wk-2026/team-history-server";

loadEnvConfig(process.cwd());

async function main() {
  const force = process.argv.includes("--force");

  console.log("[WK-TEAM-HISTORY] Starting refresh...");
  console.log(`[WK-TEAM-HISTORY] Force mode: ${force ? "on" : "off"}`);

  const summary = await refreshAllWkTeamHistories({ force });

  console.log("[WK-TEAM-HISTORY] Refresh complete");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[WK-TEAM-HISTORY] Refresh failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
