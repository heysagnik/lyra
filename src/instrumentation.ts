export async function register() {
  // Only start timers in the Node.js server runtime, never in Edge/browser/build
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startUsageMaintenanceLoop } = await import("@/lib/queue/maintenance");
  startUsageMaintenanceLoop();
}
