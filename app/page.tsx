import { HomePage } from "@/components/home-page";
import { readUyoWeather } from "@/lib/weather-server";

export default async function Page() {
  // Rendered on the server so the weather table is present in the first paint
  // instead of arriving after a client round trip.
  const initialWeather = await readUyoWeather();
  return <HomePage initialWeather={initialWeather} />;
}
