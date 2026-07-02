import Navbar from "@/components/Navbar.tsx";
import Hero from "@/components/home/Hero";
import InfiniteGallery from "@/components/home/InfiniteGallery";
import Features from "@/components/home/Features";
import CategoryExplorer from "@/components/home/CategoryExplorer";
import Stats from "@/components/home/Stats";
import CTA from "@/components/home/CTA";
import Footer from "@/components/Footer";

export function AppLayout() {
  return (
    <main>
      <Navbar />
      <Hero />
      <InfiniteGallery />
      <Features />
      <CategoryExplorer />
      <Stats />
      <CTA />
      <Footer />
    </main>
  );
}
