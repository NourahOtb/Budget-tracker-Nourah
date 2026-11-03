import type { Metadata } from "next";
import { InsightsScreen } from "@/components/screens/Insights";

// Rendered from data in the visitor's browser; see app/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Insights · Purrse" };

export default function Page() {
  return <InsightsScreen />;
}
