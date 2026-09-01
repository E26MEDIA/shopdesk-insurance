import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Insurance Desk – Insurance Management Software",
  description:
    "Insurance Desk is a professional desktop software solution for managing customers, policies, renewals, payments and daily insurance operations.",
  metadataBase: new URL("https://insurance.e26media.com"),
  openGraph: {
    title: "Insurance Desk – Insurance Management Software",
    description:
      "Insurance Desk is a professional desktop software solution for managing customers, policies, renewals, payments and daily insurance operations.",
    siteName: "Insurance Desk",
    type: "website",
    locale: "en_IN",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
