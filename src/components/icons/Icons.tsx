import React from 'react';

export const Wordmark: React.FC<{ height?: number; className?: string }> = ({
  height = 22,
  className = '',
}) => {
  const width = (height * 108) / 56;
  return (
    <svg
      className={`fkw ${className}`.trim()}
      viewBox="0 0 108 56"
      style={{ height: `${height}px`, width: `${width}px` }}
      role="img"
      aria-label="fikr"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 48V24q0-14 12-14h3M4 26h20" />
        <path d="M38 26v22" />
        <path d="M54 8v40M76 26L54 40M62 35l16 13" />
        <path d="M90 26v22M90 38q1-12 14-12" />
      </g>
      <circle className="dot" cx="38" cy="9" r="6" />
    </svg>
  );
};

export const Mark: React.FC<{ size?: number; className?: string }> = ({
  size = 36,
  className = '',
}) => {
  const borderRadius = Math.round(size * 0.3);
  const iconSize = Math.round(size * 0.62);

  return (
    <span
      className={`fkm ${className}`.trim()}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        width={iconSize}
        height={iconSize}
      >
        <path
          d="M26 50V26q0-12 12-12h3M17 28h22"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};

export const Arrow: React.FC<{
  dir?: 'r' | 'l' | 'u' | 'c';
  size?: number;
  className?: string;
}> = ({ dir = 'r', size = 20, className = '' }) => {
  const paths = {
    r: 'M5 12h14M13 6l6 6-6 6',
    l: 'M19 12H5M11 6l-6 6 6 6',
    u: 'M12 19V5M6 11l6-6 6 6',
    c: 'M9 6l6 6-6 6',
  };

  return (
    <svg
      className={`ar ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[dir]} />
    </svg>
  );
};

export const Checkmark: React.FC<{ size?: number; className?: string }> = ({
  size = 14,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const ClockIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const Illustration: React.FC<{
  type: 'start' | 'hello' | 'win' | 'clock' | 'bye' | 'build';
  className?: string;
}> = ({ type, className = '' }) => {
  const L = '#D6F25C';
  const P = '#B39BFF';
  const O = '#FFA24A';
  const W = '#F6F6F1';
  const I = '#17171A';

  const renderContent = () => {
    switch (type) {
      case 'start':
        return (
          <>
            <rect
              x="26"
              y="74"
              width="106"
              height="106"
              rx="30"
              fill={L}
              transform="rotate(-10 79 127)"
            />
            <rect
              x="88"
              y="20"
              width="106"
              height="106"
              rx="30"
              fill={P}
              transform="rotate(7 141 73)"
            />
            <rect
              x="152"
              y="82"
              width="98"
              height="98"
              rx="28"
              fill={O}
              transform="rotate(-5 201 131)"
            />
            <path
              d="M110 112l18 18 34-38"
              fill="none"
              stroke={I}
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      case 'hello':
        return (
          <>
            <rect x="20" y="30" width="200" height="124" rx="34" fill={P} />
            <path d="M70 150l-8 38 40-30z" fill={P} />
            <circle cx="82" cy="92" r="10" fill={I} />
            <circle cx="120" cy="92" r="10" fill={I} />
            <circle cx="158" cy="92" r="10" fill={I} />
            <circle cx="224" cy="150" r="32" fill={L} />
            <circle cx="248" cy="44" r="14" fill={O} />
          </>
        );
      case 'win':
        return (
          <>
            <circle cx="140" cy="100" r="66" fill={L} />
            <path
              d="M108 102l24 24 42-48"
              fill="none"
              stroke={I}
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="28"
              y="40"
              width="22"
              height="12"
              rx="6"
              fill={P}
              transform="rotate(-30 39 46)"
            />
            <rect
              x="232"
              y="56"
              width="22"
              height="12"
              rx="6"
              fill={O}
              transform="rotate(28 243 62)"
            />
            <circle cx="46" cy="150" r="9" fill={O} />
            <circle cx="238" cy="148" r="9" fill={P} />
            <rect x="214" y="12" width="14" height="14" rx="4" fill={W} />
          </>
        );
      case 'clock':
        return (
          <>
            <circle cx="140" cy="104" r="68" fill={P} />
            <circle cx="140" cy="104" r="50" fill={W} />
            <path
              d="M140 104V70M140 104l24 14"
              stroke={I}
              strokeWidth="9"
              strokeLinecap="round"
            />
            <rect x="110" y="14" width="60" height="22" rx="11" fill={O} />
            <circle cx="238" cy="52" r="12" fill={L} />
          </>
        );
      case 'bye':
        return (
          <>
            <rect x="88" y="78" width="104" height="96" rx="24" fill={O} />
            <rect x="76" y="56" width="128" height="26" rx="13" fill={P} />
            <path
              d="M122 104v50M158 104v50"
              stroke={I}
              strokeWidth="9"
              strokeLinecap="round"
            />
            <circle cx="40" cy="48" r="10" fill={L} />
            <circle cx="244" cy="130" r="14" fill={L} />
          </>
        );
      case 'build':
        return (
          <>
            <rect x="50" y="128" width="180" height="48" rx="22" fill={L} />
            <rect x="74" y="76" width="132" height="48" rx="22" fill={P} />
            <rect x="104" y="24" width="72" height="48" rx="22" fill={O} />
            <path d="M140 6v-0" stroke={I} />
            <circle cx="246" cy="40" r="9" fill={W} />
            <circle cx="34" cy="96" r="9" fill={W} />
          </>
        );
    }
  };

  return (
    <svg
      className={`ill ${className}`.trim()}
      viewBox="0 0 280 200"
      aria-hidden="true"
    >
      {renderContent()}
    </svg>
  );
};

export const RowIcon: React.FC<{
  path: string;
  color?: string;
  className?: string;
}> = ({ path, color = 'var(--lime)', className = '' }) => (
  <span className={`ri ${className}`.trim()} style={{ color }}>
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  </span>
);

export const TabIcon: React.FC<{
  type: 'today' | 'life' | 'think';
  className?: string;
}> = ({ type, className = '' }) => {
  const paths = {
    today: <path d="M4 11l8-7 8 7v9H4z" />,
    think: <path d="M4 5h16v11H9l-5 4z" />,
    life: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-5 5-6 8-6s7 1 8 6" />
      </>
    ),
  };

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  );
};
