import type { Metadata } from "next";
import { BudgetsScreen } from "@/components/screens/Budgets";

// Rendered from data in the visitor's browser; see app/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Budgets · Purrse" };

export default function Page() {
  return <BudgetsScreen />;
}
