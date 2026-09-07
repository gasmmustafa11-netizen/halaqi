import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
  children?: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, threshold = 80, enabled = true, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef<number | null>(null);
  const rootEl = useRef<HTMLElement | null>(null);

  // Capture #root element (actual scroll owner)
  useEffect(() => {
    rootEl.current = document.querySelector('#root') as HTMLElement | null;
  }, []);

  const getRootScrollTop = useCallback(() => {
    return rootEl.current?.scrollTop || 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return;
    if (e.touches.length !== 1) return;
    const scrollTop = getRootScrollTop();
    // Only activate when at top
    if (scrollTop <= 2) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [enabled, isRefreshing, getRootScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || startY.current === null || isRefreshing || !enabled) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    if (delta > 0) {
      // Apply resistance: distance grows slower than finger movement
      const resisted = Math.sqrt(delta) * 6; // progressive resistance
      setPullDistance(resisted);
      // Prevent default scroll only when pulling at top to avoid page jump
      if (getRootScrollTop() <= 2) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, isRefreshing, enabled, getRootScrollTop]);

  const handleTouchEnd = useCallback(async () => {
    setIsPulling(false);
    if (isRefreshing) return;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        // Delay slightly so spinner is visible
        setTimeout(() => setIsRefreshing(false), 400);
      }
    } else {
      // Not enough pull: smooth return
      setPullDistance(0);
    }
    startY.current = null;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const root = rootEl.current || document.querySelector('#root');
    if (!root) return;
    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });
    root.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
      root.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Calculate rotation and scale for arrow spinner
  const rotation = Math.min(pullDistance * 3, 720);
  const scale = Math.min(1 + pullDistance / 120, 1.4);
  const opacity = Math.min(pullDistance / 40, 1);

  return (
    <>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: Math.min(pullDistance + 20, 160),
          background: 'linear-gradient(to bottom, rgba(212,175,55,0.08), transparent)',
          pointerEvents: 'none',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: Math.max(pullDistance * 0.3, 12),
          transition: isPulling ? 'none' : 'height 0.3s ease-out, padding-top 0.3s ease-out',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid #D4AF37',
            borderTopColor: 'transparent',
            borderRightColor: isRefreshing ? '#D4AF37' : 'transparent',
            borderBottomColor: isRefreshing ? '#D4AF37' : 'transparent',
            borderLeftColor: isRefreshing ? '#D4AF37' : 'transparent',
            transform: `rotate(${rotation}deg) scale(${scale})`,
            opacity,
            transition: isPulling ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
            animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
          }}
        />
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </>
  );
}
