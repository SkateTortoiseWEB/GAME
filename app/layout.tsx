import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listicle — name as many as you can",
  description: "Five categories a day. Name as many as you can before the clock runs out. Climb the global ranking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
