import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LaserEyesProvider } from '@omnisat/lasereyes-react';
import { MAINNET } from '@omnisat/lasereyes-core';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LaserEyesProvider config={{ network: MAINNET }}>
          <div className="root" style={{ isolation: 'isolate' }}>
            {children}
          </div>
        </LaserEyesProvider>
      </body>
    </html>
  );
}
