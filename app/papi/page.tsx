import type { Metadata } from "next";
import { PapiScreen } from "@/components/screens/PapiChat";

// Rendered from data in the visitor's browser; see app/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "Papi · Purrse" };

export default function Page() {
  return <PapiScreen />;
}
