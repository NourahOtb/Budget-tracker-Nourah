import type { Metadata } from "next";
import { ProScreen } from "@/components/Pro";

// Rendered from data in the visitor's browser; see app/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Purrse Pro · Purrse" };

export default function Page() {
  return <ProScreen />;
}
