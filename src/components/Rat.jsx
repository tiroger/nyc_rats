export default function Rat({ className = "", label, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 140"
      fill="none"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      {...props}
    >
      {label && <title>{label}</title>}
      <path
        className="rat-tail"
        d="M51 99C-5 130 4 60 31 73C44 79 29 91 18 85"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M46 90C44 54 77 32 114 42C142 44 167 57 181 77L213 93Q222 103 207 107L177 111H70Q47 108 46 90Z"
        fill="currentColor"
      />
      <path
        d="M129 65C108 41 125 15 146 27C160 35 157 51 153 62"
        fill="currentColor"
      />
      <path
        d="M139 49C130 36 141 29 148 39"
        stroke="var(--rat-detail, #f5f3e9)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="m83 106-8 18h20m56-18 9 18h18"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="rat-eye"
        cx="175"
        cy="80"
        r="4.5"
        fill="var(--rat-detail, #f5f3e9)"
      />
      <circle cx="214" cy="97" r="4" fill="var(--rat-detail, #f5f3e9)" />
      <path
        d="m201 98 27-13m-25 17 28 4m-34 0 23 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="m192 108 2 8 7-1-2-8" fill="var(--rat-detail, #f5f3e9)" />
      <path
        d="M67 77c3-12 12-18 22-19m-21 29 9-2"
        stroke="var(--rat-detail, #f5f3e9)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".35"
      />
    </svg>
  );
}
