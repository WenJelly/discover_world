import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar.tsx";
import Hero from "@/components/home/Hero";
import InfiniteGallery from "@/components/home/InfiniteGallery";
import CTA from "@/components/home/CTA";
import Footer from "@/components/Footer";
import DiscoverPage from "@/pages/DiscoverPage";
import AccountDetailPage from "@/pages/AccountDetailPage";
import UploadPage from "@/pages/UploadPage";
import SearchPage from "@/pages/SearchPage";
import AdminPage from "@/pages/AdminPage";

export function AppLayout() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const mainRef = useRef<HTMLElement>(null);

  const focusMainContent = useCallback(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      window.requestAnimationFrame(focusMainContent);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [focusMainContent]);

  const isDiscoverRoute = pathname === "/discover";
  const isLegacyPublicRoute = pathname === "/public";
  const isAccountRoute = pathname === "/account";
  const isUploadRoute = pathname === "/upload";
  const isSearchRoute = pathname === "/search";
  const isAdminRoute = pathname === "/admin";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-950 focus:shadow-lg"
      >
        跳到主要内容
      </a>
      <Navbar fixed={!isDiscoverRoute && !isLegacyPublicRoute} />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        aria-live="polite"
        className="outline-none"
      >
        {isAccountRoute ? (
          <AccountDetailPage />
        ) : isUploadRoute ? (
          <UploadPage />
        ) : isSearchRoute ? (
          <SearchPage />
        ) : isAdminRoute ? (
          <AdminPage />
        ) : isDiscoverRoute || isLegacyPublicRoute ? (
          <DiscoverPage />
        ) : (
          <>
            <Hero />
            <InfiniteGallery />
            <CTA />
          </>
        )}
        <Footer />
      </main>
    </>
  );
}
