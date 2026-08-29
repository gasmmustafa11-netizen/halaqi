import React from 'react';

const THICKNESS = 4;
const DEFAULT_SIZE = 56;

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  isAtThreshold: boolean;
  onHide: () => void;
  size?: number;
  color?: string;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  isAtThreshold,
  onHide,
  size = DEFAULT_SIZE,
  color = '#D4AF37',
}) => {
  const radius = Math.max(1, size / 2 - THICKNESS);
  const perimeter = 2 * Math.PI * radius;
  const progress = Math.min(1, pullDistance / 80);
  const strokeDashoffset = perimeter * (1 - progress);

  const shouldShow = !isRefreshing || pullDistance > 0;
  const translateY = pullDistance * 0.8;

  if (!shouldShow && pullDistance === 0) {
    return null;
  }

  const dashArray = `${perimeter} ${perimeter}`;
  const dashOffset = `${perimeter - strokeDashoffset} ${perimeter}`;

  const indicatorSize = size;
  const viewBox = `0 0 ${indicatorSize} ${indicatorSize}`;

  if (isRefreshing) {
    return (
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        <div
          style={{
            width: indicatorSize + 20,
            height: indicatorSize + 20,
            marginTop: -10,
            marginLeft: -10,
            border: `${THICKNESS}px solid ${color}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: 0,
        transform: `translateX(-50%) translateY(${translateY}px)`,
        pointerEvents: 'none',
        zIndex: 100,
        transition: 'transform 120ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <svg
        width={indicatorSize}
        height={indicatorSize}
        viewBox={viewBox}
      >
        <circle
          cx={indicatorSize / 2}
          cy={indicatorSize / 2}
          r={radius}
          stroke={color}
          strokeWidth={THICKNESS}
          fill='none'
          strokeDasharray={dashArray}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
    </div>
  );
};