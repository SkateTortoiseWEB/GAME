import type { Metadata } from "next";
import App from "./App";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pawmpeii: name as many as you can",
  description: "One question per genre each day. Name as many answers as you can before the lava reaches Cinder the panda, and climb the daily leaderboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <App />
        {children}
      </body>
    </html>
  );
}
