export function GET() {
  return Response.json({ status: "ok", service: "smart-farming-web", timestamp: new Date().toISOString() });
}
