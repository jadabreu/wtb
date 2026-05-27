import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "What to Build?",
  description: "Find customer problems worth solving"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
