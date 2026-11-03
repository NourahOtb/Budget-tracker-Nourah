import type { Metadata } from "next";
import { SpendingScreen } from "@/components/screens/Spending";

// Rendered from data in the visitor's browser; see app/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Spending · Purrse" };

export default function Page() {
  return <SpendingScreen />;
}
