import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operator Console — Grid Operations Control Room",
  description: "Real-time fault detection, incident lifecycle control, and telemetry simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#07111f] text-[#f5f7ff]">
        {children}
      </body>
    </html>
  );
}
