export default function HeroBackground() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <svg className="hero-bg-pile" viewBox="0 0 220 150" focusable="false">
        <defs>
          <clipPath id="pile-ground">
            <rect x="0" y="0" width="220" height="115" />
          </clipPath>
        </defs>
        <ellipse cx="115" cy="119" rx="90" ry="6" fill="var(--accent)" opacity="0.12" />
        <g clipPath="url(#pile-ground)" fill="var(--accent)" opacity="0.45">
          <ellipse cx="70" cy="115" rx="55" ry="32" />
          <ellipse cx="115" cy="100" rx="42" ry="38" />
          <ellipse cx="155" cy="115" rx="45" ry="26" />
        </g>
        <g
          fill="none"
          stroke="var(--brand-dark)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        >
          <path d="M48,100 q7,-5 14,-2" />
          <path d="M100,72 q6,-4 13,1" />
          <path d="M135,98 q-5,-6 -13,-5" />
          <path d="M160,108 q7,-3 12,2" />
          <path d="M85,112 q-6,-4 -12,-1" />
        </g>
      </svg>

      <svg className="hero-bg-truck" viewBox="0 0 300 170" focusable="false">
        <ellipse cx="140" cy="143" rx="112" ry="6" fill="var(--brand)" opacity="0.15" />

        {/* motion lines trailing behind */}
        <g stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" opacity="0.3">
          <line x1="0" y1="78" x2="32" y2="78" />
          <line x1="6" y1="95" x2="30" y2="95" />
          <line x1="10" y1="112" x2="28" y2="112" />
        </g>

        {/* leaves lifting off the back */}
        <g fill="var(--accent)" opacity="0.55">
          <g transform="translate(60,45) rotate(-15) scale(0.9)">
            <path d="M0,0 C6,-8 16,-8 20,0 C16,8 6,8 0,0 Z" />
          </g>
          <g transform="translate(25,30) rotate(10) scale(0.7)">
            <path d="M0,0 C6,-8 16,-8 20,0 C16,8 6,8 0,0 Z" />
          </g>
          <g transform="translate(92,18) rotate(-30) scale(0.6)">
            <path d="M0,0 C6,-8 16,-8 20,0 C16,8 6,8 0,0 Z" />
          </g>
          <g transform="translate(5,56) rotate(20) scale(0.55)">
            <path d="M0,0 C6,-8 16,-8 20,0 C16,8 6,8 0,0 Z" />
          </g>
        </g>

        {/* truck body, facing right (direction of travel) */}
        <g fill="var(--brand)" opacity="0.42">
          <rect x="178" y="25" width="6" height="35" rx="2" />
          <rect x="40" y="62" width="140" height="10" rx="3" />
          <rect x="40" y="70" width="140" height="45" rx="4" />
          <rect x="185" y="50" width="50" height="65" rx="6" />
          <path d="M235,75 L258,88 L258,115 L235,115 Z" />
          <rect x="250" y="60" width="10" height="4" rx="2" />
          <rect x="32" y="108" width="14" height="8" rx="2" />
          <circle cx="75" cy="125" r="17" />
          <circle cx="140" cy="125" r="17" />
          <circle cx="205" cy="125" r="15" />
        </g>

        {/* cutouts: windshield + wheel hubs */}
        <g fill="var(--bg)">
          <rect x="193" y="58" width="28" height="24" rx="4" />
          <circle cx="75" cy="125" r="6" />
          <circle cx="140" cy="125" r="6" />
          <circle cx="205" cy="125" r="5" />
        </g>
      </svg>
    </div>
  );
}
