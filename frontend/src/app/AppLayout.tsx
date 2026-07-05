import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar.tsx";
import Hero from "@/components/home/Hero";
import InfiniteGallery from "@/components/home/InfiniteGallery";
import Features from "@/components/home/Features";
import Stats from "@/components/home/Stats";
import CTA from "@/components/home/CTA";
import Footer from "@/components/Footer";
import PublicGalleryPage from "@/pages/PublicGalleryPage";
import AccountDetailPage from "@/pages/AccountDetailPage";
import UploadPage from "@/pages/UploadPage";

export function AppLayout() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const isPublicRoute = pathname === "/public";
  const isAccountRoute = pathname === "/account";
  const isUploadRoute = pathname === "/upload";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-950 focus:shadow-lg"
      >
        跳到主要内容
      </a>
      <Navbar />
      <main id="main-content">
        {isAccountRoute ? (
          <AccountDetailPage />
        ) : isUploadRoute ? (
          <UploadPage />
        ) : isPublicRoute ? (
          <PublicGalleryPage />
        ) : (
          <>
            <Hero />
            <InfiniteGallery />
            <Features />
            <Stats />
            <CTA />
          </>
        )}
        <Footer />
      </main>
    </>
  );
}
