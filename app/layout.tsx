import type { Metadata } from "next";
import { Navbar } from "@/components/Layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocToolkit",
  description: "Client-side PDF editing, image editing, conversion, and scanning tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
