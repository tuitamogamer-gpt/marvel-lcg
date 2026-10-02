import { DOCTOR_STRANGE_INVOCATIONS } from "./game/doctor-strange";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cards,
  CheckCircle,
  Eye,
  MagnifyingGlass,
  Package,
  X,
} from "@phosphor-icons/react";
import { ASPECTS, CATALOG_CARDS, card, imageFor, plain } from "./game/cards";
import { deckErrors } from "./game/decks";
import {
  CATALOG_HEROES,
  CATALOG_SUMMARY,
  PRODUCTS,
  catalogDeckCodes,
  productForCard,
  productsForDeck,
} from "./game/catalog";
import type { CatalogDeck, Product } from "./game/catalog";
import "./content-browser.css";

const label = (value: string) => value.replaceAll("_", " ");
const releaseDate = (value?: string) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Release date not listed";
const cardProducts = new Map(
  CATALOG_CARDS.map((c) => [c.code, productForCard(c.code)]),
);
const heroProductTypes = [
  ...new Set(CATALOG_HEROES.map((h) => h.product.typeLabel)),
];
const cardFactions = [
  ...new Set(CATALOG_CARDS.map((c) => c.faction_code).filter(Boolean)),
].sort();
const cardTypes = [
  ...new Set(CATALOG_CARDS.map((c) => c.type_code).filter(Boolean)),
].sort();
const HERO_PAGE_SIZE = 14;
const CARD_PAGE_SIZE = 36;

function ProductDetails({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  return (
    <div className={`product-source ${compact ? "compact" : ""}`}>
      <Package size={compact ? 15 : 19} aria-hidden="true" />
      <div>
        <strong>
          <a href={product.url} target="_blank" rel="noreferrer">
            {product.name}
            <ArrowUpRight size={12} aria-label="Product reference" />
          </a>
        </strong>
        <span>
          {product.typeLabel}
          {product.pack_type_code === "encounter"
            ? " · Free downloadable set"
            : product.soldSeparately
              ? " · Sold separately"
              : " · Included in this product"}
          {!compact &&
            (product.date_release
              ? ` · Released ${releaseDate(product.date_release)}`
              : " · Release date not listed")}
        </span>
      </div>
    </div>
  );
}

export function ProductSource({
  code,
  compact = false,
}: {
  code: string;
  compact?: boolean;
}) {
  const product = productForCard(code);
  return product ? (
    <ProductDetails product={product} compact={compact} />
  ) : null;
}

export function DeckProvenance({
  codes,
  custom = false,
  sourceName,
}: {
  codes: string[];
  custom?: boolean;
  sourceName?: string;
}) {
  const products = productsForDeck(codes);
  return (
    <div className="deck-provenance">
      <span className="small-label">DECK ORIGIN</span>
      <p>
        {sourceName
          ? `Source preconstructed list: ${sourceName}. The products below supply its cards.`
          : custom
            ? "Your saved deck. The products below supply its cards."
            : "App-constructed starter deck. The products below supply its cards; this list may differ from the source preconstructed deck."}
      </p>
      <div className="deck-product-list">
        {products.map((product) => (
          <ProductDetails key={product.code} product={product} compact />
        ))}
      </div>
    </div>
  );
}

function Pagination({
  page,
  count,
  size,
  onChange,
  noun,
}: {
  page: number;
  count: number;
  size: number;
  onChange: (page: number) => void;
  noun: string;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <nav className="catalog-pagination" aria-label={`${noun} pages`}>
      <button
        className="secondary-button"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        aria-label={`Previous ${noun} page`}
      >
        <ArrowLeft size={16} /> Previous
      </button>
      <span aria-live="polite">
        {count
          ? `${page * size + 1}–${Math.min((page + 1) * size, count)} of ${count}`
          : "0 results"}
      </span>
      <button
        className="secondary-button"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
        aria-label={`Next ${noun} page`}
      >
        Next <ArrowRight size={16} />
      </button>
    </nav>
  );
}

function CatalogArtwork({
  code,
  onInspect,
}: {
  code: string;
  onInspect: (code: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="catalog-identity-art"
      data-card-preview={code}
      onClick={() => onInspect(code)}
      aria-label={`Inspect ${card(code)?.name || "identity card"}`}
    >
      {failed ? (
        <span className="catalog-art-fallback">
          <Cards size={36} />
          <b>{card(code)?.name}</b>
          <small>Open card details</small>
        </span>
      ) : (
        <img
          src={imageFor(code)}
          alt={card(code)?.name || "Identity card"}
          width="300"
          height="419"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <span>
        <Eye size={14} /> Read identity card
      </span>
    </button>
  );
}

function DeckDescription({ deck }: { deck: CatalogDeck }) {
  const constructed =
    /app|constructed/i.test(deck.sourceType) &&
    !/preconstructed/i.test(deck.sourceType);
  return (
    <p className="catalog-deck-description">
      {constructed
        ? "App-constructed starter deck. Its cards come from the products shown below."
        : "Imported preconstructed deck list for this hero’s product."}
      {deck.sourceUrl && (
        <>
          {" "}
          <a
            className="text-link"
            href={deck.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Deck list source <ArrowUpRight size={13} />
          </a>
        </>
      )}
    </p>
  );
}

function DeckCardList({
  counts,
  setupCards = {},
  onInspect,
  className,
}: {
  counts: Record<string, number>;
  setupCards?: Record<string, number>;
  onInspect: (code: string) => void;
  className: string;
}) {
  return (
    <div className={className}>
      {Object.entries(counts).map(([code, quantity]) => (
        <button
          key={code}
          data-card-preview={code}
          onClick={() => onInspect(code)}
        >
          <span>
            <b>{card(code)?.name || code}</b>
            <small>
              {label(card(code)?.faction_code || "")} ·{" "}
              {productForCard(code)?.name || "Product not listed"}
              {setupCards[code] ? " · Starts in play" : ""}
            </small>
          </span>
          <strong>×{quantity}</strong>
        </button>
      ))}
    </div>
  );
}

export function ContentBrowser({
  initialHeroCode,
  assignedHeroIds,
  onChooseHero,
  onInspect,
}: {
  initialHeroCode: string;
  assignedHeroIds: string[];
  onChooseHero: (
    id: string,
    aspect: string,
    codes?: string[],
    deckName?: string,
  ) => void;
  onInspect: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState("all");
  const [productCode, setProductCode] = useState("all");
  const [page, setPage] = useState(0);
  const [heroCode, setHeroCode] = useState(initialHeroCode);
  const [deckId, setDeckId] = useState("");
  const [form, setForm] = useState<"hero" | "alter">("hero");
  const [identityCode, setIdentityCode] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const filtered = useMemo(
    () =>
      CATALOG_HEROES.filter(
        (hero) =>
          (!query ||
            `${hero.name} ${hero.identity} ${hero.product.name}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())) &&
          (productType === "all" || hero.product.typeLabel === productType) &&
          (productCode === "all" || hero.packCode === productCode),
      ),
    [query, productType, productCode],
  );
  const hero =
    CATALOG_HEROES.find((h) => h.code === heroCode) || CATALOG_HEROES[0];
  const deck = hero.decks.find((d) => d.id === deckId) || hero.decks[0];
  const codes = deck ? catalogDeckCodes(deck) : [];
  const setupCount = Object.values(deck?.setupCards || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const supplementaryCount = Object.values(
    deck?.supplementaryCards || {},
  ).reduce((a, b) => a + b, 0);
  const supplementaryReady =
    !supplementaryCount ||
    (hero.id === "doctor_strange" &&
      Object.keys(deck?.supplementaryCards || {}).length ===
        DOCTOR_STRANGE_INVOCATIONS.length &&
      Object.entries(deck?.supplementaryCards || {}).every(
        ([code, count]) =>
          (DOCTOR_STRANGE_INVOCATIONS as readonly string[]).includes(code) &&
          count === 1,
      ));
  const deckSize = deck?.deckSize ?? codes.length - setupCount;
  const deckAspect = ASPECTS.find((aspect) => aspect.id === deck?.aspect)?.id;
  const validationErrors =
    hero.automated && deck && deckAspect
      ? deckErrors(hero.id, deckAspect, codes)
      : [];
  const appStarter = deck?.sourceType === "app-starter";
  const canLaunchDeck = !!(
    hero.automated &&
    deck &&
    deckAspect &&
    !validationErrors.length &&
    !setupCount &&
    supplementaryReady
  );
  const fallbackReason =
    setupCount || !supplementaryReady
      ? "This list requires additional setup or special decks."
      : !deckAspect
        ? "This list requires deckbuilding rules that are not yet available for missions."
        : validationErrors[0];
  const deckAspects = deck?.aspects?.length
    ? deck.aspects.map(label)
    : [label(deck?.aspect || "Hero")];
  const deckProducts = productsForDeck([
    ...codes,
    ...Object.keys(deck?.supplementaryCards || {}),
  ]);
  const assigned = assignedHeroIds.includes(hero.id);
  const shownCode =
    identityCode && hero.identityCodes.includes(identityCode)
      ? identityCode
      : form === "hero"
        ? hero.code
        : hero.alter;
  const heroProducts = PRODUCTS.filter((p) =>
    CATALOG_HEROES.some((h) => h.packCode === p.code),
  );
  const resetFilters = () => {
    setQuery("");
    setProductType("all");
    setProductCode("all");
    setPage(0);
  };
  return (
    <div className="content-browser">
      <p className="catalog-intro">
        <b>{CATALOG_SUMMARY.heroes} heroes, every released product.</b> Explore
        identities, starter decks and where their cards come from.
      </p>
      <div className="catalog-layout">
        <section className="catalog-roster" aria-label="Browse imported heroes">
          <label className="search-box">
            <MagnifyingGlass size={18} aria-hidden="true" />
            <input
              aria-label="Search heroes and products"
              placeholder="Hero, alter ego or product…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear hero search"
                onClick={() => {
                  setQuery("");
                  setPage(0);
                }}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div className="catalog-roster-filters">
            <select
              aria-label="Filter hero product type"
              value={productType}
              onChange={(e) => {
                setProductType(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All product types</option>
              {heroProductTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter hero product"
              value={productCode}
              onChange={(e) => {
                setProductCode(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All hero products</option>
              {heroProducts.map((product) => (
                <option key={product.code} value={product.code}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <span className="catalog-result-count" aria-live="polite">
            {filtered.length} heroes
          </span>
          <div className="catalog-hero-list">
            {filtered
              .slice(page * HERO_PAGE_SIZE, (page + 1) * HERO_PAGE_SIZE)
              .map((h) => (
                <button
                  className={`catalog-hero-row ${h.code === hero.code ? "selected" : ""}`}
                  key={h.code}
                  aria-pressed={h.code === hero.code}
                  onClick={() => {
                    setHeroCode(h.code);
                    setDeckId("");
                    setForm("hero");
                    setIdentityCode("");
                    requestAnimationFrame(() =>
                      detailRef.current?.scrollIntoView({ block: "start" }),
                    );
                  }}
                >
                  <span>
                    <b>{h.name}</b>
                    <small>{h.identity}</small>
                    <em>{h.product.name}</em>
                  </span>
                  {h.automated ? (
                    <CheckCircle
                      size={17}
                      aria-label="Automated for missions"
                    />
                  ) : (
                    <BookOpen size={17} aria-label="Catalog preview" />
                  )}
                </button>
              ))}
            {!filtered.length && (
              <div className="catalog-empty">
                <p>No matching heroes.</p>
                <button className="text-button" onClick={resetFilters}>
                  Clear filters <X size={14} />
                </button>
              </div>
            )}
          </div>
          <Pagination
            page={page}
            count={filtered.length}
            size={HERO_PAGE_SIZE}
            onChange={setPage}
            noun="hero"
          />
        </section>
        <section
          className="catalog-hero-detail"
          aria-label={`${hero.name} product and deck`}
          ref={detailRef}
        >
          <div className="catalog-detail-heading">
            <span className="small-label">HERO DOSSIER</span>
            <h3>{hero.name}</h3>
            <p>{hero.identity}</p>
          </div>
          <ProductDetails product={hero.product} />
          <div className="catalog-identity-section">
            <div>
              <CatalogArtwork
                key={shownCode}
                code={shownCode}
                onInspect={onInspect}
              />
              <div
                className="catalog-form-switch"
                role="group"
                aria-label="Identity side"
              >
                <button
                  aria-pressed={shownCode === hero.code}
                  onClick={() => {
                    setForm("hero");
                    setIdentityCode("");
                  }}
                >
                  Hero
                </button>
                <button
                  aria-pressed={shownCode === hero.alter}
                  onClick={() => {
                    setForm("alter");
                    setIdentityCode("");
                  }}
                >
                  Alter ego
                </button>
              </div>
              {hero.identityCodes.length > 2 && (
                <select
                  className="catalog-identity-select"
                  aria-label="Choose identity form"
                  value={shownCode}
                  onChange={(e) => setIdentityCode(e.target.value)}
                >
                  {hero.identityCodes.map((code) => (
                    <option key={code} value={code}>
                      {card(code)?.name}
                      {card(code)?.subname
                        ? ` · ${card(code).subname}`
                        : ""} · {label(card(code)?.type_code || "identity")}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="catalog-mission-status">
              <span
                className={`catalog-status ${hero.automated ? "automated" : ""}`}
              >
                {hero.automated ? (
                  <CheckCircle size={16} />
                ) : (
                  <BookOpen size={16} />
                )}
                {hero.automated
                  ? "Ready for automated missions"
                  : "Imported · rules automation pending"}
              </span>
              <p>
                {hero.automated
                  ? "This hero’s identity, signature set, obligation and nemesis are supported. Each deck list is checked before mission setup."
                  : "The identity and deck list are available to explore. This hero’s abilities and expansion cards are not yet automated for missions."}
              </p>
              {hero.automated && (
                <button
                  className="primary-button"
                  disabled={assigned}
                  onClick={() =>
                    canLaunchDeck
                      ? onChooseHero(
                          hero.id,
                          deckAspect!,
                          appStarter ? undefined : [...codes],
                          appStarter ? undefined : deck.name,
                        )
                      : onChooseHero(hero.id, hero.aspect || "")
                  }
                >
                  {assigned
                    ? "Already assigned to another seat"
                    : canLaunchDeck
                      ? `Choose ${hero.name} for mission`
                      : `Choose ${hero.name} with app starter`}{" "}
                  {!assigned && <ArrowRight size={16} />}
                </button>
              )}
              {hero.automated && (
                <small className="catalog-default-deck-note">
                  {canLaunchDeck
                    ? appStarter
                      ? "Mission setup uses the app starter deck shown below."
                      : `Mission setup will load this exact ${deckSize}-card source preconstructed list.`
                    : `The displayed source list cannot launch yet. ${fallbackReason || "This deck is not ready for the rules engine."} Mission setup can use this hero’s default app starter deck.`}
                </small>
              )}
            </div>
          </div>
          <div className="catalog-deck-heading">
            <Cards size={20} />
            <h4>STARTER DECK</h4>
          </div>
          {hero.decks.length > 1 && (
            <select
              className="catalog-deck-select"
              aria-label="Choose starter deck"
              value={deck?.id || ""}
              onChange={(e) => setDeckId(e.target.value)}
            >
              {hero.decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {deck ? (
            <>
              <div className="catalog-deck-title">
                <b>{deck.name}</b>
                <span>
                  {deckSize} cards in deck ·{" "}
                  {deckAspects.length > 1 ? "Card aspects: " : ""}
                  {deckAspects.join(" / ")}
                </span>
              </div>
              {!!setupCount && (
                <p className="catalog-deck-composition">
                  {codes.length} cards in the starter composition, including{" "}
                  {setupCount} that start in play.
                </p>
              )}
              <DeckDescription deck={deck} />
              {deck.sourceNote && (
                <div className="catalog-source-note">
                  <b>Source notes</b>
                  <p>{deck.sourceNote}</p>
                </div>
              )}
              <div className="catalog-deck-products">
                <span className="small-label">CARDS SUPPLIED BY</span>
                {deckProducts.map((product) => (
                  <ProductDetails
                    key={product.code}
                    product={product}
                    compact
                  />
                ))}
              </div>
              <DeckCardList
                counts={deck.cards}
                setupCards={deck.setupCards}
                onInspect={onInspect}
                className="catalog-deck-list"
              />
              {!!setupCount && (
                <section className="catalog-starts-in-play">
                  <h4>
                    STARTS IN PLAY · {setupCount}{" "}
                    {setupCount === 1 ? "CARD" : "CARDS"}
                  </h4>
                  <p>
                    These Permanent cards are included in the composition above.
                    They begin in play and do not count toward deck-size limits.
                  </p>
                  <DeckCardList
                    counts={deck.setupCards || {}}
                    onInspect={onInspect}
                    className="catalog-auxiliary-list"
                  />
                </section>
              )}
              {!!supplementaryCount && (
                <section className="catalog-supplementary-cards">
                  <h4>HERO’S ADDITIONAL CARDS · {supplementaryCount}</h4>
                  <p>
                    This hero’s special cards are supplied separately from the
                    starter composition above. Inspect each card for its setup
                    instructions.
                  </p>
                  <DeckCardList
                    counts={deck.supplementaryCards || {}}
                    onInspect={onInspect}
                    className="catalog-auxiliary-list"
                  />
                </section>
              )}
            </>
          ) : (
            <p className="catalog-deck-description">
              A starter deck list is not available from the imported source for
              this hero. The identity and cards remain available in the
              Collection.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function Collection({
  onInspect,
  renderCard,
}: {
  onInspect: (code: string) => void;
  renderCard: (code: string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("all");
  const [type, setType] = useState("all");
  const [product, setProduct] = useState("all");
  const [page, setPage] = useState(0);
  const cards = useMemo(
    () =>
      CATALOG_CARDS.filter(
        (c) =>
          (!query ||
            `${c.name} ${c.subname || ""} ${c.traits || ""} ${plain(c.text)} ${cardProducts.get(c.code)?.name || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())) &&
          (faction === "all" || c.faction_code === faction) &&
          (type === "all" || c.type_code === type) &&
          (product === "all" || cardProducts.get(c.code)?.code === product),
      ),
    [query, faction, type, product],
  );
  const reset = () => {
    setQuery("");
    setFaction("all");
    setType("all");
    setProduct("all");
    setPage(0);
  };
  const changePage = (next: number) => {
    setPage(next);
    document
      .getElementById("catalog-cards-heading")
      ?.scrollIntoView({ block: "start" });
  };
  return (
    <main
      id="main-content"
      className="collection catalog-collection page-width"
    >
      <div className="collection-title">
        <span className="comic-caption">THE S.H.I.E.L.D. ARCHIVES</span>
        <h1>
          KNOW YOUR <span>SUPERPOWERS.</span>
        </h1>
        <p>
          {CATALOG_SUMMARY.cardFaces.toLocaleString()} card faces across{" "}
          {CATALOG_SUMMARY.products} released products. Player cards, encounters
          and campaign content.
        </p>
      </div>
      <div id="catalog-cards-heading" className="collection-toolbar">
        <label className="search-box">
          <MagnifyingGlass size={19} />
          <input
            placeholder="Search name, trait, card text or product…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            aria-label="Search cards"
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <select
          value={product}
          onChange={(e) => {
            setProduct(e.target.value);
            setPage(0);
          }}
          aria-label="Filter card product"
        >
          <option value="all">All products</option>
          {PRODUCTS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} · {p.typeLabel}
            </option>
          ))}
        </select>
        <select
          value={faction}
          onChange={(e) => {
            setFaction(e.target.value);
            setPage(0);
          }}
          aria-label="Filter card faction"
        >
          <option value="all">All aspects & factions</option>
          {cardFactions.map((f) => (
            <option key={f} value={f}>
              {label(f)}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(0);
          }}
          aria-label="Filter card type"
        >
          <option value="all">All card types</option>
          {cardTypes.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </select>
        <span aria-live="polite">
          {cards.length.toLocaleString()} card faces
        </span>
        {(query ||
          faction !== "all" ||
          type !== "all" ||
          product !== "all") && (
          <button className="text-button" onClick={reset}>
            Clear filters <X size={14} />
          </button>
        )}
      </div>
      <div className="collection-catalog-note">
        <BookOpen size={17} />
        <span>
          Every card retains its source product. Imported expansion cards are
          available to read. Supported heroes and cards can be used in automated
          missions; additional rules are still being implemented.
        </span>
      </div>
      {cards.length ? (
        <>
          <Pagination
            page={page}
            count={cards.length}
            size={CARD_PAGE_SIZE}
            onChange={changePage}
            noun="card"
          />
          <div className="collection-grid">
            {cards
              .slice(page * CARD_PAGE_SIZE, (page + 1) * CARD_PAGE_SIZE)
              .map((c) => (
                <button
                  key={c.code}
                  className="collection-card"
                  onClick={() => onInspect(c.code)}
                >
                  {renderCard(c.code)}
                  <strong>{c.name}</strong>
                  <span>
                    {label(c.type_code)}
                    <small>#{c.code}</small>
                  </span>
                  <small className="collection-product">
                    {cardProducts.get(c.code)?.name || "Product not listed"}
                  </small>
                </button>
              ))}
          </div>
          <Pagination
            page={page}
            count={cards.length}
            size={CARD_PAGE_SIZE}
            onChange={changePage}
            noun="card"
          />
        </>
      ) : (
        <div className="empty-results">
          <MagnifyingGlass size={40} />
          <h2>No cards found</h2>
          <p>Try a different name or clear the filters.</p>
          <button className="secondary-button" onClick={reset}>
            Clear filters
          </button>
        </div>
      )}
    </main>
  );
}
