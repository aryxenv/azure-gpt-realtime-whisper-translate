import { useCallback, useRef } from "react";
import type { TouchEvent } from "react";

interface SwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

/** Swipe is only active on phone-sized viewports. */
const PHONE_SWIPE_MEDIA_QUERY = "(max-width: 900px)";
/** Minimum horizontal travel (px) before a gesture counts as a swipe. */
const SWIPE_MIN_DISTANCE = 64;
/** Maximum vertical travel (px) allowed; beyond this it is a scroll. */
const SWIPE_MAX_VERTICAL_DRIFT = 96;
/** Horizontal travel must exceed vertical travel by this factor. */
const SWIPE_DIRECTION_RATIO = 1.35;

function isPhoneViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PHONE_SWIPE_MEDIA_QUERY).matches
  );
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
}: SwipeNavigationOptions) {
  const origin = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((event: TouchEvent) => {
    if (!isPhoneViewport() || event.touches.length !== 1) {
      origin.current = null;
      return;
    }

    const touch = event.touches[0];
    origin.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      const start = origin.current;
      origin.current = null;

      const touch = event.changedTouches[0];
      if (!start || !touch) {
        return;
      }

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const absoluteX = Math.abs(deltaX);
      const absoluteY = Math.abs(deltaY);

      if (
        absoluteX < SWIPE_MIN_DISTANCE ||
        absoluteY > SWIPE_MAX_VERTICAL_DRIFT ||
        absoluteX < absoluteY * SWIPE_DIRECTION_RATIO
      ) {
        return;
      }

      if (deltaX < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight],
  );

  return { onTouchStart, onTouchEnd };
}
