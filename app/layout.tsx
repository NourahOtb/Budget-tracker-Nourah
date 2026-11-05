import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { AuthGate } from "@/components/Auth";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Every screen is built from the signed-in person's data, so pages render
// after that loads rather than during prerender.
export const instant = false;

export const metadata: Metadata = {
  title: "Purrse",
  description: "A playful budget tracker with Papi the cat.",
  icons: { icon: "/papi/papi-content.svg" },
};

export const viewport: Viewport = {
  themeColor: "#1C1822",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`}>
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
