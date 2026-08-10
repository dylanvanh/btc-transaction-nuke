import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { LaserEyesProvider, MAINNET } from "@omnisat/lasereyes-react";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bitcoin Transaction Nuke",
  description: "Cancel Bitcoin transactions through double spending",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`}>
        <LaserEyesProvider config={{ network: MAINNET }}>
          <div className="root" style={{ isolation: 'isolate' }}>
            {children}
          </div>
        </LaserEyesProvider>
      </body>
    </html>
  );
}
