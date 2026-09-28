import { readUyoWeather } from "@/lib/weather-server";

export async function GET() {
  if (!process.env.OPENWEATHER_API_KEY) {
    return Response.json(
      { error: "weather_not_configured", message: "Set a rotated OPENWEATHER_API_KEY on the server." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const weather = await readUyoWeather();
  if (!weather) {
    return Response.json(
      { error: "weather_unavailable", message: "Live Uyo weather is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(weather, {
    headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=1800" },
  });
}
