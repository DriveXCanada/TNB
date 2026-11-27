/** Public address of the app, used for client tracking links. */
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
