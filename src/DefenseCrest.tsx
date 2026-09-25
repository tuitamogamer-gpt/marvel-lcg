import { useId } from "react";

/** A beveled enamel defense marker, drawn specifically for this table. */
export function DefenseCrest({ numbered = false }: { numbered?: boolean }) {
  const id = useId();
  return (
    <svg
      className="defense-crest"
      viewBox="0 0 60 66"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-rim`}
          x1="8"
          y1="4"
          x2="48"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff4d1" />
          <stop offset=".25" stopColor="#c3dceb" />
          <stop offset=".48" stopColor="#748fa9" />
          <stop offset=".7" stopColor="#e4eff4" />
          <stop offset="1" stopColor="#718ba5" />
        </linearGradient>
        <linearGradient
          id={`${id}-enamel`}
          x1="15"
          y1="9"
          x2="47"
          y2="55"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#318ac2" />
          <stop offset=".45" stopColor="#1d5683" />
          <stop offset="1" stopColor="#102a49" />
        </linearGradient>
      </defs>
      <path
        d="M30 2 57 12l-3 25c-2 12-12 20-24 27C18 57 8 49 6 37L3 12Z"
        fill="#081421"
        stroke="#07101d"
        strokeWidth="2"
      />
      <path
        d="M30 4 55 13l-3 23c-2 11-11 19-22 26C19 55 10 47 8 36L5 13Z"
        fill={`url(#${id}-rim)`}
      />
      <path
        d="m30 9 20 7-2 20c-2 9-9 16-18 22-9-6-16-13-18-22l-2-20Z"
        fill={`url(#${id}-enamel)`}
        stroke="#0c2943"
        strokeWidth="1.5"
      />
      <path
        d="m14 19 16-6 16 6M15 35c1 7 7 14 15 19"
        stroke="#b4e8ff"
        strokeOpacity=".6"
        strokeWidth="1.2"
      />
      <path d="m30 14 16 5-2 15-14 17Z" fill="#071b32" fillOpacity=".2" />
      <path
        d="m9 16 2 15M51 16l-2 15"
        stroke="#fff5d9"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="30" cy="8" r="1.5" fill="#fff7df" />
      <path
        d="m26 49 4 3 4-3"
        stroke="#9fcce4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!numbered && <path d="m19 27 11-7 11 7-11 18Z" fill="#e8f5fb" />}
      {!numbered && <path d="m23 28 7-4 7 4-7 10Z" fill="#739ebd" />}
    </svg>
  );
}

export function DefensePlaque({
  value,
  exhausted,
}: {
  value: number;
  exhausted: boolean;
}) {
  return (
    <div
      className="defense-plaque"
      data-exhausted={exhausted}
      role="group"
      aria-label="Hero defense"
      title={
        exhausted
          ? "Your hero must be ready to defend an attack."
          : `When attacked, exhaust your hero to prevent up to ${value} damage with basic defense.`
      }
    >
      <span className="defense-plaque-value">
        <DefenseCrest numbered />
        <b>{value}</b>
      </span>
      <span className="defense-plaque-copy">
        <strong>Defense</strong>
        <small>{exhausted ? "Hero exhausted" : "Ready when attacked"}</small>
      </span>
    </div>
  );
}
