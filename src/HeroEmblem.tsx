import { HandFist } from "@phosphor-icons/react";

/** Decorative identity marks, kept crisp at every table size. */
export function HeroEmblem({ heroId }: { heroId: string }) {
  if (heroId === "she_hulk")
    return <HandFist aria-hidden="true" weight="fill" />;

  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {heroId === "black_panther" ? (
        <>
          <path
            d="m10 7 9 6h10l9-6-2 15 2 8-14 12L10 30l2-8Z"
            fill="currentColor"
          />
          <path
            d="m14 21 8 4-7 2Zm20 0-8 4 7 2ZM20 32h8l-4 5Z"
            fill="var(--emblem-ink)"
          />
          <path
            d="m17 15 7 6 7-6M24 11v9"
            stroke="var(--emblem-ink)"
            strokeWidth="2"
          />
        </>
      ) : heroId === "spider_man" ? (
        <>
          <ellipse cx="24" cy="28" rx="5" ry="9" fill="currentColor" />
          <circle cx="24" cy="16" r="4" fill="currentColor" />
          <path
            d="m21 20-9-7-2-7m17 14 9-7 2-7M20 23 9 19l-3-7m22 11 11-4 3-7M20 27 9 29l-2 9m21-11 11 2 2 9M21 31l-7 6v6m13-12 7 6v6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : heroId === "iron_man" ? (
        <>
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="24"
            r="13"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="7 3"
          />
          <path d="m24 15 10 17H14Z" fill="currentColor" />
        </>
      ) : (
        <path
          d="m24 3 5 13 12-5-7 12 11 5-15 3-6 14-6-14-15-3 11-5-7-12 12 5Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}
