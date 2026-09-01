import { Footer } from "@/components/marketing/Footer";
import { Navbar } from "@/components/marketing/Navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-site">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
