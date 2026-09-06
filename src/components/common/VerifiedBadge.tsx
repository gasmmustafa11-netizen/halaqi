import React from 'react';
import './VerifiedBadge.css';

const VerifiedBadge: React.FC = () => {
  return (
    <span className="verified-badge" aria-label="Verified user">
      <svg
        className="badge-scalloped"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <g fill="#D4AF37">
          <circle cx="8" cy="8" r="6.5" />
          <circle cx="8" cy="2.2" r="2.8" />
          <circle cx="11.3" cy="4.3" r="2.8" />
          <circle cx="12.8" cy="8" r="2.8" />
          <circle cx="11.3" cy="11.7" r="2.8" />
          <circle cx="8" cy="13.8" r="2.8" />
          <circle cx="4.7" cy="11.7" r="2.8" />
          <circle cx="3.2" cy="8" r="2.8" />
          <circle cx="4.7" cy="4.3" r="2.8" />
        </g>
      </svg>
      <span className="badge-check">✓</span>
    </span>
  );
};

export default VerifiedBadge;
