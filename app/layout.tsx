import type { Metadata } from "next";
import SoundToggle from "./audio/SoundToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pawmpeii — name as many as you can",
  description: "One question per genre, every day. Name as many as you can before the lava reaches Cinder the panda. Climb the global ranking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SoundToggle />
      </body>
    </html>
  );
}
