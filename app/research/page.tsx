import type { Metadata } from "next";
import { ResearchPage } from "@/components/research-page";

export const metadata: Metadata = {
  title: "Research",
  description: "Methods, evidence, data provenance and limitations of the M.Eng smart agriculture study.",
};

export default function Page() {
  return <ResearchPage />;
}
