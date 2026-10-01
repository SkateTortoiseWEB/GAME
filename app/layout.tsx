import type { Metadata, Viewport } from "next";
import App from "./App";
import "./globals.css";

const description = "One question per genre each day. Name as many answers as you can before the lava reaches Cinder the panda, and climb the daily leaderboard.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Pawmpeii: name as many as you can",
  description,
  openGraph: { title: "Pawmpeii", description, type: "website", images: ["/panda/idle.png"] },
  twitter: { card: "summary", title: "Pawmpeii", description, images: ["/panda/idle.png"] },
};

export const viewport: Viewport = { themeColor: "#0e0d12" };

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
