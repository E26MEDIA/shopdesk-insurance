import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { StoreProvider } from "@/lib/store";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "ShopDesk — Insurance + PUC",
  description: "Simple shop software for vehicle insurance and PUC",
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
          <AppNav />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
