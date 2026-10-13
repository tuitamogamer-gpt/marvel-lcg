import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { HEROES, card, imageFor } from "./game/cards";
import { productForCard } from "./game/catalog";
import { matchesSearch, searchTerms, searchText } from "./search";
import "./mission-setup.css";

type Hero = (typeof HEROES)[number];
const entries = HEROES.map((hero) => ({
  hero,
  text: searchText(
    `${hero.name} ${hero.identity} ${hero.style} ${card(hero.code).traits || ""} ${productForCard(hero.code)?.name || ""}`,
  ),
}));
const filters = [
  { id: "all", name: "All heroes" },
  { id: "easy", name: "Easy to learn" },
  { id: "core", name: "Core set" },
] as const;

export function HeroRoster({
  selectedId,
  assignedIds,
  onChoose,
}: {
  selectedId: string;
  assignedIds: string[];
  onChoose: (hero: Hero) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const roster = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const terms = searchTerms(query);
  const heroes = entries.filter(
    ({ hero, text }) =>
      matchesSearch(text, terms) &&
      (filter !== "easy" || hero.complexity === 1) &&
      (filter !== "core" || card(hero.code).pack_code === "core"),
  );
  const reset = () => {
    setQuery("");
    setFilter("all");
    input.current?.focus();
  };
  return (
    <div className="hero-picker">
      <label className="search-box hero-search">
        <MagnifyingGlass size={19} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          aria-label="Search playable heroes"
          placeholder="Find a hero, alter ego or team…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (roster.current) roster.current.scrollTop = 0;
          }}
        />
        {query && (
          <button
            className="icon-button"
            aria-label="Clear playable hero search"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        )}
      </label>
      <div className="hero-picker-toolbar">
        <div
          className="hero-quick-filters"
          role="group"
          aria-label="Hero filters"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => {
                setFilter(item.id);
                if (roster.current) roster.current.scrollTop = 0;
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <span className="hero-match-count" role="status">
          {heroes.length} of {HEROES.length} heroes
        </span>
      </div>
      {heroes.length ? (
        <div
          className="hero-roster-window"
          ref={roster}
          role="region"
          aria-label="Playable heroes"
          tabIndex={0}
        >
          <div className="hero-roster">
            {heroes.map(({ hero }) => {
              const assigned = assignedIds.includes(hero.id);
              return (
                <button
                  key={hero.id}
                  className={`hero-tile ${hero.id === selectedId ? "selected" : ""}`}
                  style={{ "--accent": hero.color } as CSSProperties}
                  onClick={() => onChoose(hero)}
                  disabled={assigned}
                  title={
                    assigned
                      ? "Already assigned to another hero seat"
                      : hero.name
                  }
                  aria-pressed={hero.id === selectedId}
                >
                  <div className="portrait">
                    <img
                      data-card-preview={hero.code}
                      src={imageFor(hero.code)}
                      alt={hero.name}
                      loading="lazy"
                      decoding="async"
                      width="300"
                      height="419"
                    />
                  </div>
                  {hero.id === selectedId && (
                    <span className="selected-check">
                      <Check size={14} weight="bold" />
                    </span>
                  )}
                  <div className="hero-tile-copy">
                    <strong>{hero.name}</strong>
                    <small>{hero.identity}</small>
                  </div>
                  <span className="tile-border" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="hero-search-empty">
          <MagnifyingGlass size={26} aria-hidden="true" />
          <b>No heroes match these filters.</b>
          <span>
            Try an alter ego, a team like Avengers, or clear the filters.
          </span>
          <button className="secondary-button" onClick={reset}>
            Show all heroes
          </button>
        </div>
      )}
      <div className="hero-picker-footer">
        <span>
          Selected: <b>{HEROES.find((hero) => hero.id === selectedId)?.name}</b>
        </span>
        {query || filter !== "all" ? (
          <button className="text-button" onClick={reset}>
            Clear filters <X size={13} />
          </button>
        ) : (
          <span>Scroll to explore the roster</span>
        )}
      </div>
    </div>
  );
}
