"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server page every `seconds` while the tab is visible, so new attempts appear on their own. */
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => !document.hidden && router.refresh(), seconds * 1000);
    const onShow = () => !document.hidden && router.refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [router, seconds]);
  return null;
}
