import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inline PDF Editor",
  description: "Client-side PDF editor for inline document text changes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
