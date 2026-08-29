import { useState, useCallback, useRef } from 'react';

const DEFAULT_THRESHOLD = 80;

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  scrollRef: {
    current: HTMLElement | null;
  };
}

export interface UsePullToRefreshResult {
  pullDistance: number;
  isRefreshing: boolean;
  isAtThreshold: boolean;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
  reset: () => void;
}

export function usePullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  scrollRef,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atTop = scrollTop <= 0;

    if (!atTop) {
      // Not at top of container, don't start pull-to-refresh
      return;
    }

    startY.current = e.touches[0].clientY;
    setPullDistance(0);
  }, [scrollRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === null) return;

    const deltaY = e.touches[0].clientY - startY.current;

    // Only pull downward from top
    if (deltaY > 0) {
      // Apply natural resistance: use sqrt-based easing for natural feel
      // resistance factor: closer to finger movement near top, more resistance as pull increases
      const rawDistance = deltaY;
      const resistedDistance = 2 * Math.sqrt(rawDistance + 1) - 2;

      setPullDistance(resistedDistance);
    }
  }, [scrollRef]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      });
    } else {
      // Smoothly animate back to resting position
      setPullDistance(0);
    }

    startY.current = null;
  }, [pullDistance, threshold, onRefresh]);

  const isAtThreshold = pullDistance >= threshold;

  const reset = useCallback(() => {
    setPullDistance(0);
    setIsRefreshing(false);
    startY.current = null;
  }, []);

  return {
    pullDistance,
    isRefreshing,
    isAtThreshold,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    reset,
  };
}