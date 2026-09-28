import type { Metadata } from "next";
import { PredictPage } from "@/components/predict-page";

export const metadata: Metadata = {
  title: "Crop recommendation",
  description: "Enter soil nutrient, weather, pH and rainfall readings to explore a crop recommendation.",
};

export default function Page() {
  return <PredictPage />;
}
