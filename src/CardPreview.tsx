import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { card, imageFor, plain } from "./game/cards";

type Preview = { code: string; left: number; top: number; width: number };
const backs = {
  "back:hero": { name: "Hero deck · face down", kind: "hero" },
  "back:encounter": {
    name: "Encounter deck · face down",
    kind: "encounter",
  },
};
const backFor = (code: string) => backs[code as keyof typeof backs];

/** One viewport-level preview covers card faces, thumbnails and text-only lists. */
export function CardPreview() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const popup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anchor: HTMLElement | null = null;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    const clear = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
    const close = () => {
      clear();
      anchor = null;
      shown = false;
      setPreview(null);
    };
    const candidate = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const direct = target.closest<HTMLElement>("[data-card-preview]");
      return (
        direct ||
        target
          .closest("button, [tabindex]")
          ?.querySelector<HTMLElement>("[data-card-preview]") ||
        null
      );
    };
    const open = (next: HTMLElement | null) => {
      clear();
      if (!next) return;
      if (anchor === next && shown) return;
      anchor = next;
      setPreview(null);
      shown = false;
      openTimer = setTimeout(() => {
        const code = next.dataset.cardPreview;
        if (!code || (!card(code) && !backFor(code)) || !next.isConnected)
          return;
        const landscape = ["main_scheme", "side_scheme"].includes(
          card(code)?.type_code,
        );
        const ratio = landscape ? 419 / 300 : 300 / 419;
        const width = Math.max(
          1,
          Math.min(
            landscape ? 540 : 365,
            innerWidth - 24,
            (innerHeight - 82) * ratio,
          ),
        );
        const height = width / ratio + 54;
        const rect = next.getBoundingClientRect();
        // Prefer the adjacent free side. Never clip a card at a viewport edge.
        let left = rect.right + 16;
        if (left + width > innerWidth - 12) left = rect.left - width - 16;
        left = Math.max(12, Math.min(left, innerWidth - width - 12));
        const top = Math.max(
          12,
          Math.min(
            rect.top + rect.height / 2 - height / 2,
            innerHeight - height - 12,
          ),
        );
        setFailed(false);
        setPreview({ code, left, top, width });
        shown = true;
      }, 260);
    };
    const insidePopup = (target: EventTarget | null) =>
      target instanceof Node && popup.current?.contains(target);
    const enter = (event: PointerEvent | FocusEvent) => {
      if (event instanceof PointerEvent && event.pointerType === "touch")
        return;
      if (insidePopup(event.target)) {
        clear();
        return;
      }
      open(candidate(event.target));
    };
    const leave = (event: PointerEvent | FocusEvent) => {
      if (insidePopup(event.relatedTarget)) {
        clear();
        return;
      }
      const next = candidate(event.relatedTarget);
      if (next && next === anchor) return;
      clear();
      closeTimer = setTimeout(close, 180);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A pending hover must not swallow Escape intended for an open dialog.
      if (shown) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      close();
    };
    const scroll = (event: Event) => {
      if (!insidePopup(event.target)) close();
    };
    const observer = new MutationObserver(() => {
      if (anchor && (!anchor.isConnected || !anchor.getClientRects().length))
        close();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      clear();
      observer.disconnect();
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, []);

  if (!preview) return null;
  const c = card(preview.code);
  const back = backFor(preview.code);
  const name = back?.name || c.name;
  return createPortal(
    <div
      ref={popup}
      className="card-hover-preview"
      role="tooltip"
      aria-label={`Enlarged card: ${name}`}
      style={{ left: preview.left, top: preview.top, width: preview.width }}
    >
      {back ? (
        <span
          className={`premium-card-back preview-card-back back-${back.kind}`}
          aria-hidden="true"
        >
          <span className="card-back-mark">MARVEL</span>
        </span>
      ) : failed ? (
        <div className="preview-fallback">
          <strong>{name}</strong>
          <p>{plain(c?.text)}</p>
        </div>
      ) : (
        <img
          src={imageFor(preview.code)}
          alt={name}
          onError={() => setFailed(true)}
        />
      )}
      <div className="preview-caption">
        <strong>{name}</strong>
        <span>ESC to dismiss</span>
      </div>
    </div>,
    document.body,
  );
}
