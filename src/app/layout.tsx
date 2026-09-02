import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { StoreProvider } from "@/lib/store";
import { LicenseGate } from "@/licensing/LicenseGate";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Insurance Desk — E26",
  description: "Professional insurance shop software by E26",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <StoreProvider>
          <LicenseGate>
            <AppNav />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          </LicenseGate>
        </StoreProvider>
      </body>
    </html>
  );
}
