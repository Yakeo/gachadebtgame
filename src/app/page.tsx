import Game from "@/components/game-shell";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { maintenanceStatus } from "@/lib/maintenance";

/**
 * Evaluated per request, not at build time: the maintenance flag has to be
 * readable when the deploy that sets it lands, without waiting for a rebuild.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const status = maintenanceStatus();
  // Only while an operator has closed the game (MAINTENANCE_MODE=on). Nobody
  // boots in - not even to the title screen - while a patch is applying.
  if (status.active) return <MaintenanceScreen info={status} />;
  return <Game />;
}
