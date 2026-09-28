import type { Metadata } from "next";
import { IrrigatePage } from "@/components/irrigate-page";

export const metadata: Metadata = {
  title: "Irrigation decision",
  description: "Enter soil moisture, temperature and humidity for one of five crops to check whether to irrigate now, with authored watering guidance.",
};

export default function Page() {
  return <IrrigatePage />;
}
