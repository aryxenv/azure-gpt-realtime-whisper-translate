import { useCallback, useEffect, useMemo, useState } from "react";
import { shouldIgnorePresentationShortcut } from "@/lib/presentation-shortcuts";

const arrowKeys = new Set(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]);

const SLIDE_PARAM = "slide";

function readIndexFromUrl(slideIds: readonly string[]): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const id = new URLSearchParams(window.location.search).get(SLIDE_PARAM);
  const index = id ? slideIds.indexOf(id) : -1;
  return index >= 0 ? index : 0;
}

export function usePresentationNavigation(slideIds: readonly string[]) {
  const slideCount = slideIds.length;
  const [activeIndex, setActiveIndex] = useState(() =>
    readIndexFromUrl(slideIds),
  );

  const previousSlide = useCallback(() => {
    setActiveIndex((current) =>
      slideCount === 0 ? 0 : (current - 1 + slideCount) % slideCount,
    );
  }, [slideCount]);

  const nextSlide = useCallback(() => {
    setActiveIndex((current) =>
      slideCount === 0 ? 0 : (current + 1) % slideCount,
    );
  }, [slideCount]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(slideCount - 1, 0)));
  }, [slideCount]);

  // Reflect the active slide in the URL (?slide=<id>) so refreshing returns to
  // the same slide and the link can be shared.
  useEffect(() => {
    const id = slideIds[activeIndex];
    if (!id) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get(SLIDE_PARAM) === id) {
      return;
    }

    params.set(SLIDE_PARAM, id);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${query}${window.location.hash}`,
    );
  }, [activeIndex, slideIds]);

  // Respond to back/forward navigation and manual URL edits.
  useEffect(() => {
    function handlePopState() {
      setActiveIndex(readIndexFromUrl(slideIds));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [slideIds]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !arrowKeys.has(event.key) ||
        shouldIgnorePresentationShortcut(event)
      ) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        nextSlide();
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        previousSlide();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, previousSlide]);

  return useMemo(
    () => ({
      activeIndex,
      canGoNext: slideCount > 1,
      canGoPrevious: slideCount > 1,
      nextSlide,
      previousSlide,
      progress: slideCount === 0 ? 0 : (activeIndex + 1) / slideCount,
    }),
    [activeIndex, nextSlide, previousSlide, slideCount],
  );
}
