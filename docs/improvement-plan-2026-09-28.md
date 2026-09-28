# Plan poboljšanja — Marvel Champions: The Tabletop

Datum: 28.09.2026. Pregledani commit: `d3fffcd` (main, čist radni direktorij). Ovo je plan, ne izmjena koda: ništa u `src/` nije dirano.

## Status izvršenja

- **29.09.2026 — Faza 1 (stabilnost) urađena:** P0.1 tempo (Vođeno/Brzo/Ekspert + vremenska linija + Enter za Proceed), P0.3 CI, P0.4 error boundary i oporavak save-a, P0.5 keširanje slika i lijeno učitavanje biblioteke, P3.4 sigurnosni headeri, Open Graph, manifest, ikone i service worker. P0.2: Redis nije prioritet (odluka vlasnika); „Sign in“ i čuvanje deckova se sakrivaju dok storage nije podešen. Konverzija slika u WebP i preimenovanje `.png` fajlova nisu rađeni jer traže brisanje 209 fajlova iz repoa; to ostaje za posebno odobrenje.

- **29.09.2026 — Faza 2 djelimično urađena:** P1.1 (Play dugme na karti, „Suggest resources“, hover zaštita), P1.5 undo (Ctrl/Cmd+Z, do prve otkrivene skrivene karte), P1.7 kraj misije (statistika, kopiranje rezultata, ponavljanje istog seeda, lokalna historija za goste), P2.1 Heroic 0–3, seed, dnevna misija i nasumični izbor. Ostaje P1.2 (raspored bez skrolanja) i sve od Faze 3 nadalje.

## Kako je pregled rađen

- Pročitani su engine (`src/game/engine.ts`), UI (`src/App.tsx`), account server (`server/`), testovi, skripte, dokumentacija i `progress.md`.
- Pokrenuti su `npm test` (233 testa, svi prolaze) i `npm run build` (prolazi). `npm audit`: 0 ranjivosti.
- Odigrana je misija na živom sajtu (https://marvel-lcg.vercel.app) na 1440×900 i na mobilnom prikazu (375×812). Konzola bez grešaka.
- Simulirano je 12 kompletnih misija (4 postave × 3 seeda) kroz pravi `dispatch`, sa istom jednostavnom politikom kao u testovima, uz brojanje Proceed klikova, odluka i veličine save-a. Rezultati su u tabeli ispod.

## Sažetak nalaza

**Šta je dobro:** engine prati Rules Reference 1.8 (25 grupa nalaza iz audita je popravljeno i pokriveno testovima), sve 15 kombinacija heroj/villain završavaju misiju bez gubitka karata, save/resume radi, nalozi su sigurno implementirani (scrypt, HttpOnly cookie, CSRF provjera, rate limit), vizuelni sloj je bogat i pristupačan (axe auditi prolaze).

**Glavni propusti (po redu važnosti):**

1. **Previše klikova.** Igra staje na svakoj sitnici. Izmjereno: solo 11–21 Proceed klikova po rundi (od toga 6–12 samo u villain fazi), sa 3 heroja 28–44 Proceed klikova po rundi, plus 4–30 odluka po rundi. Prije prvog poteza u novoj misiji igrač mora kliknuti Proceed dva puta na prazne korake („Opening hand confirmed“, „Take the next hero's turn“).
2. **Nalozi u produkciji ne rade.** Živi sajt vraća `storage: "unavailable"`; dugme „Sign in“ vodi na poruku da nalozi nisu dostupni. Redis (Upstash) nikad nije povezan.
3. **Nema zaštitne mreže.** Nema CI-ja (testovi se ne pokreću prije deploya), nema error boundary-ja (jedna greška u renderu = bijeli ekran bez izlaza), nema PWA/offline režima, slike karata se ne keširaju (`max-age=0`, 209 zahtjeva po sesiji).
4. **Kod je teško proširiv.** `App.tsx` 4.225 linija, `engine.ts` 4.645 linija, funkcija `resolve()` 1.292 linije, 304 tvrdo kodirane šifre karata u engineu, `styles.css` 6.218 linija. Svaka ekspanzija znači ručno pisanje skripti u istim ogromnim fajlovima.
5. **Onboarding je tanak.** Samo modal sa 6 savjeta; nema tutorijala, savjeta tokom igre ni glosara ključnih riječi (Guard, Tough, Surge…). Testni bot gubi 12 od 12 simuliranih misija, pa ne postoji automatski signal da je scenarij uopšte pobjediv poslije izmjena.
6. **Mobilni je sekundaran.** Sto je visok 2.619 px na širini od 375 px, sve zavisi od hover previewa koji na touch ekranu ne postoji.
7. **Deck builder je osnovan.** Padajući meniji bez slika, filtera, statistike ili uvoza sa MarvelCDB-a.
8. **Sadržaj je ograničen na core set.** Nema Heroic moda, kampanje/ljestvice, ekspanzija ni pravog online co-opa.

### Izmjereni tok igre (simulacija, prava engine logika)

| Postava | Ishod | Proceed / runda | od toga villain faza | Odluke / runda | Max save |
|---|---|---|---|---|---|
| Solo Spider-Man vs Rhino (3 seeda) | 3× poraz, r2–r4 | 11,5–18,5 | 6,5–9,8 | 4,0–4,5 | 26 KB |
| Solo Captain Marvel vs Klaw | 3× poraz, r2–r6 | 19,7–21,2 | 10,5–12,5 | 6,7–7,5 | 35 KB |
| 3 heroja vs Ultron | 3× poraz, r2–r4 | 32,0–44,3 | 19,5–29,5 | 17,5–29,5 | 61 KB |
| 3 heroja vs Rhino | 3× poraz, r4–r7 | 27,6–31,5 | 13,3–15,5 | 11,6–13,0 | 61 KB |

Porazi govore o glupoj testnoj politici (odbacuje cijelu ruku, ne brani se), ne o balansu. Broj klikova je stvaran. Veličina save-a je mala i nije problem.

### Provjereno i u redu (ne dirati)

- Obavezno odbacivanje do hand size na kraju faze: RRG 1.8 to izričito traži („must discard down to their hand size“). Engine je ispravan.
- Save/resume, migracija starih solo save-ova, deterministički RNG.
- Ownership karata između heroja, eliminacija heroja, rotacija prvog igrača.
- Sigurnost naloga (hash lozinke, kolačići, origin provjera, CAS zapisi).

## Prioritet 0 — odmah (stabilnost i najveći bol)

### P0.1 Tempo igre: tri brzine umjesto Proceed na svakom koraku

- **Šta:** podešavanje „Tempo“ sa tri nivoa: *Vođeno* (sadašnje ponašanje, ostaje podrazumijevano za nove igrače), *Brzo* (zaustavlja se samo na odlukama, šteti heroju/allyju, postavljanju threata, otkrivanju encounter karte, porazu i promjeni stagea) i *Ekspert* (zaustavlja se samo na odlukama i šteti; sve ostalo ide u vremensku liniju).
- **Zašto:** 11–44 Proceed klikova po rundi je najveći razlog da neko odustane. Zahtjev da „sve bude vidljivo“ ostaje ispunjen: sve što se preskoči i dalje je zapisano i vidljivo u panelu.
- **Kako:** u `src/game/engine.ts` funkcija `run()` i `continuesReview()` odlučuju gdje se staje; dodati `pacing` u `GameState` (čuva se u save-u) i pravilo koje spaja „nebitne“ preglede (predaja poteza, potvrda otvorene ruke, potvrda odbacivanja, „team readies“, otkrivanje običnih boost karata bez zvjezdice) u sljedeći bitan. Prazne korake iz početka misije ukloniti u svim tempima. U UI dodati prekidač u Action Resolution panelu i u lobiju, uz kratak opis; zapamtiti izbor u `localStorage`. Dodati globalnu prečicu (Enter/Space) za Proceed kad nema otvorenog polja za unos.
- **Provjera:** proširiti simulaciju iz `tests/hotseat.test.ts` da broji Proceed po rundi i tvrdi gornju granicu za *Brzo* (cilj: solo ≤ 6, tri heroja ≤ 15 po rundi). Postojeći browser flow test za *Vođeno* mora ostati nepromijenjen.
- **Trud:** M.

### P0.2 Nalozi u produkciji

- **Šta:** povezati Upstash Redis na Vercel projekat i verifikovati, ili do tada sakriti „Sign in“ i sve što ga spominje.
- **Zašto:** sajt danas reklamira naloge, deckove i historiju koje ne rade. Gost koji klikne „Sign in“ vidi obavještenje o nedostupnosti.
- **Kako:** koraci su već opisani u `docs/player-accounts.md` (Storage → Upstash, `UPSTASH_REDIS_REST_URL`/`TOKEN`, redeploy). Zatim pokrenuti `npm run test:accounts` protiv deploya sa jednokratnim test nalogom. Ako se nalozi ne žele odmah, u `App.tsx` uslovno sakriti account navigaciju kad je `session.storage === "unavailable"`.
- **Napomena:** minimalna lozinka od 15 znakova i oporavak isključivo kodom su sigurni, ali će mnoge igrače odbiti. Prijedlog: 12 znakova i vidljivije upozorenje da se kod za oporavak mora sačuvati. Odluka je vlasnika.
- **Trud:** S.

### P0.3 CI pipeline

- **Šta:** GitHub Actions workflow koji na svaki push/PR pokreće `npm ci`, `npm test`, `npm run build` i `npm run format:check`; opcionalno Playwright `test:flow` uz dev server.
- **Zašto:** deploy na Vercel ide bez ijednog automatskog testa. Sva ta infrastruktura (7 test fajlova, 5 browser skripti) postoji, ali se pokreće samo ručno.
- **Kako:** `.github/workflows/ci.yml` (Node 22, keš za npm). U Vercelu uključiti „Ignored Build Step“ ili zaštitu grane tako da produkcija ide samo sa zelenim CI-jem. Dodati `engines.node` u `package.json` i `.nvmrc`.
- **Trud:** S.

### P0.4 Error boundary i oporavak save-a

- **Šta:** React error boundary oko stola i lobija sa dugmadima „Pokušaj ponovo“ i „Obriši sačuvanu igru“; provjera `version` polja pri učitavanju.
- **Zašto:** `readSave()` hvata samo JSON grešku. Neispravan ili stari save koji prođe parse može srušiti render (npr. nepoznata šifra karte poslije sync-a podataka), a igrač nema način da se izvuče osim ručnog brisanja `localStorage`-a.
- **Kako:** komponenta `ErrorBoundary` u `src/`, fallback UI sa opisom greške; u `upgradeSave()` eksplicitna migracija po verziji i test u `tests/hotseat.test.ts` sa namjerno pokvarenim save-om.
- **Trud:** S.

### P0.5 Keširanje i format slika

- **Šta:** dugotrajni `Cache-Control` za `/cards/*` i `/art/*`, ispravan format slika, preload karata trenutne misije.
- **Zašto:** 209 slika (10,6 MB) se danas ponovo validira pri svakoj posjeti (`max-age=0, must-revalidate`). Fajlovi u `public/cards` su JPEG podaci sa `.png` ekstenzijom.
- **Kako:** `headers` sekcija u `vercel.json` (`public, max-age=31536000, immutable`; nazivi su stabilne šifre karata). Konverzija u WebP kroz `scripts/sync-cards.mjs` (očekivano ~40 % manje) uz zadržavanje originala u `output/`. Na startu misije preload slika heroja, villaina, scheme-a i otvorene ruke. Dodati `loading="lazy"` u Card library (sada učitava svih 209 odjednom).
- **Trud:** S.

## Prioritet 1 — igračko iskustvo

### P1.1 Igranje karte u manje koraka

- **Šta:** direktno „Play“ dugme na karti u ruci (danas svaki klik na kartu otvara inspekciju, iako karta ima natpis PLAY), „Predloži plaćanje“ u prozoru za resurse (bira najmanje vrijedne karte koje zadovoljavaju tipizirane zahtjeve; igrač potvrđuje ili mijenja), sprječavanje hover previewa koji iskoči ispod nepomaknutog kursora čim se otvori prozor za plaćanje.
- **Zašto:** igranje jedne karte danas traži 4–5 klikova (karta → Play card → izbor 1–4 karte → Confirm → Proceed).
- **Kako:** `Tabletop` hand kartica dobija sekundarno dugme; `PaymentDecision` koristi `paymentStatus()` iz `src/game/payment.ts` za predlog; `CardPreview` traži pomak pokazivača prije prikaza poslije otvaranja modala.
- **Trud:** M.

### P1.2 Raspored stola bez skrolanja na laptopu

- **Šta:** na 1440×900 i 1366×768 istovremeno vidljivi villain, heroj, ruka i akcije.
- **Zašto:** danas su ruka i traka Attack/Thwart/Defense ispod pregiba; zaglavlja (topbar, Mission control red, naslov sa ciljevima, traka playmata, oznake zona) troše oko 350 px.
- **Kako:** spojiti naslov misije i ciljeve u jedan red, oznake zona pretvoriti u tanke natpise, traku akcija učiniti sticky uz dno, ruku prikazati kao lepezu koja se proširuje na hover. Provjeru dodati u `scripts/design-check.mjs` (tvrdnja: ruka i akcije unutar viewporta na 1366×768).
- **Trud:** M.

### P1.3 Onboarding i pomoć u igri

- **Šta:** vođena tutorijal misija (Spider-Man vs Rhino, fiksni seed, koraci sa strelicama i objašnjenjem), glosar ključnih riječi kao hover čipovi u tekstu karte, poruka „zašto ne mogu“ vidljiva na karti (danas je samo u `title` tooltipu), kratki checklist za prvu igru.
- **Zašto:** igra pretpostavlja da igrač zna pravila; modal „How to play“ sa 6 kartica to ne pokriva.
- **Kako:** tutorijal kao skriptirani sloj iznad postojećeg enginea (lista koraka: očekivana komanda + tekst), bez izmjene pravila; glosar iz RRG 1.8 teksta koji već postoji u `output/rules-audit/`.
- **Trud:** L.

### P1.4 Pametniji bot: savjet za potez i provjera pobjedivosti

- **Šta:** heuristički bot (brani se kad je udarac smrtonosan, thwartuje kad je threat blizu limita, čuva karte za odbranu, procjenjuje vrijednost karata) koji služi za dugme „Predloži potez“ i za test da svaka kombinacija heroj/villain ima razumnu stopu pobjede na Standardu.
- **Zašto:** sadašnji testni bot gubi 12/12 misija, pa nijedan test ne bi primijetio ako izmjena enginea učini scenarij nepobjedivim.
- **Kako:** `src/game/advisor.ts` koji koristi `playable()`, `targets()`, `paymentSources()` i `heroStats()`; test sa 20 seedova po paru i pragom (npr. ≥ 30 % pobjeda na Standardu) kao regresija.
- **Trud:** L.

### P1.5 Undo unutar vlastitog poteza

- **Šta:** vraćanje jednog koraka unazad tokom hero faze, sve dok nije otkrivena skrivena informacija (izvlačenje, encounter, boost).
- **Zašto:** pogrešan klik na Attack umjesto Thwart danas košta cijeli potez. Digitalne LCG igre ovo standardno nude.
- **Kako:** engine je čist i serijalizovan, pa je dovoljno čuvati stek prethodnih stanja po komandi u `App.tsx` i označiti u `dispatch()` komande koje troše RNG ili otkrivaju karte (poslije njih stek se prazni).
- **Trud:** M.

### P1.6 Mobilni raspored ili jasna granica

- **Šta:** ili poseban telefonski raspored (tabovi Villain / Sto / Ruka, donji dock za akcije, tap-and-hold umjesto hovera, veći ciljevi za prst), ili u lobiju jasno reći da je igra za desktop i tablet.
- **Zašto:** sto na telefonu je 2.619 px visok i traži stalno skrolanje između villaina i ruke; hover preview ne postoji na touchu.
- **Kako:** prvo odluka o obimu. Ako se ide na raspored: `src/tabletop.css` breakpoint ≤ 700 px, komponenta `MobileTable` sa istim engine komandama, provjere u `scripts/tabletop-check.mjs` (320/390 px već postoje).
- **Trud:** L (raspored) ili S (natpis).

### P1.7 Kraj misije i ponavljanje

- **Šta:** rezultat sa statistikom (runde, nanesena šteta, uklonjen threat, odigrane karte, MVP karta), „Igraj ponovo sa istim seedom“, dijeljenje rezultata kao tekst, lokalna historija za goste.
- **Zašto:** danas rezultat kaže samo pobjeda/poraz i broj rundi; nema razloga za novi pokušaj.
- **Kako:** brojači u `recordReview()`/`log()` već bilježe promjene; agregirati u `summarize()`; seed je u `GameState`.
- **Trud:** S–M.

## Prioritet 2 — sadržaj i dubina

### P2.1 Heroic mod, nasumični izbor i seed

- **Šta:** Heroic 1–3 (RRG: dodatne encounter karte po igraču u Deal koraku), dugmad „Nasumični heroj/villain/modul“, polje za seed i „Dnevna misija“ (isti seed za sve tog dana).
- **Zašto:** jeftina raznolikost bez novih karata; RRG već definiše Heroic.
- **Kako:** `dealEncounters` u engineu dobija `heroic` iz konfiguracije; lobi dobija polja; seed već postoji u stanju.
- **Trud:** S.

### P2.2 Spremnost za ekspanzije: karte kao podaci, ne kao kod

- **Šta:** engine podijeliti na module (`attack.ts`, `encounter.ts`, `payment.ts`, `keywords.ts`, `effects/`), skripte karata u registar po setu (`src/cards/core/*.ts`, ključ = šifra karte), jedinstven sistem modifikatora (ATK/THW/DEF/hand size) umjesto tvrdo kodiranih šifri u `heroStats()` i `pieceHP()`.
- **Zašto:** 304 reference na šifre karata i `resolve()` od 1.292 linije znače da svaka nova karta mijenja iste ogromne fajlove; rizik regresije raste, a ekspanzije (Green Goblin, Captain America, Ms. Marvel…) su glavni razlog da se igra dugo igra.
- **Kako:** refaktor po koracima uz postojeća 233 testa kao zaštitu: 1) izdvojiti keyword obradu, 2) izdvojiti attack/scheme tok, 3) registar skripti karata, 4) modifikatori. Tek onda prva ekspanzija kroz isti MarvelCDB pipeline (`scripts/sync-cards.mjs`).
- **Trud:** XL (refaktor) + L po ekspanziji.

### P2.3 Ljestvica misija i napredak

- **Šta:** „Mission ladder“: tri villaina redom uz rastuću težinu i modul; napredak čuvan u nalogu; nagrada je samo statistika i bedževi.
- **Zašto:** core set nema kampanju; ljestvica daje cilj dužem igranju bez novih karata.
- **Trud:** M (zavisi od P0.2).

### P2.4 Deck builder

- **Šta:** mreža sa slikama karata, filteri (tip, cijena, resurs, trait, aspekt), tekstualna pretraga, kriva cijene i raspodjela resursa, uvoz/izvoz MarvelCDB liste, dijeljenje decka kodom.
- **Zašto:** sadašnji builder je lista sa padajućim menijima za broj kopija; bez slika i statistike nije za igrače koji vole deck-building.
- **Kako:** `src/account/AccountPage.tsx` → izdvojiti `DeckEditor` u vlastiti folder; ponovo koristiti `Collection` filtere i `CardPreview`; `deckErrors()` ostaje jedini izvor validacije.
- **Trud:** M.

### P2.5 Pravi online co-op

- **Šta:** dva ili tri igrača na različitim uređajima za istim stolom.
- **Zašto:** hot-seat je zamjena; co-op je srž ove igre.
- **Kako:** engine je deterministički i radi na komandama, pa je dovoljno sinhronizovati dnevnik komandi kroz realtime relay (Ably, PartyKit ili Supabase Realtime; Vercel funkcije ne drže WebSocket). Lobi sa kodom sobe, svako sjedište vezano za nalog. Raditi poslije P2.2.
- **Trud:** XL.

### P2.6 Preostale granice pravila (male)

- Opcioni efekti pri ulasku (Spider-Woman, Maria Hill) sada se rješavaju automatski; namjerno neuspješna pretraga (Shuri/Foresight) nije moguća; jedan tip za sve wild resurse u plaćanju; kod izjednačenih miniona attachment ide na prvog; obligation alternativna kazna bez izbora forme. Sve je dokumentovano u `docs/rules-coverage.md`; svaka stavka je S.

## Prioritet 3 — kod, alati i održavanje

### P3.1 Podjela velikih fajlova

- `App.tsx` (4.225 linija; `App()` 1.239, `Tabletop()` 1.237) u foldere `lobby/`, `table/`, `dialogs/`, `review/`; `styles.css` (6.218 linija) plus još 9 CSS fajlova (ukupno ~11.400 linija) u CSS po komponenti; 20-ak različitih breakpointa (600/680/700/720/760/980/999/1000…) svesti na 3–4 tokena. Raditi prije P2.2.
- **Trud:** L.

### P3.2 Alati

- ESLint (`typescript-eslint`, `react-hooks`, `jsx-a11y`), uključiti `noUnusedLocals`; planirati nadogradnje (Vite 6→8, Vitest 4→5, plugin-react 4→6, TypeScript 5.9→7.0 su velike verzije; raditi jednu po jednu uz CI); ukloniti `ExperimentalWarning` za SQLite pinovanjem Node verzije.
- **Trud:** S–M.

### P3.3 Testovi

- Fuzz test enginea: nasumične legalne komande kroz `dispatch()` uz invarijante (nema izuzetka, nema zaglavljenog prompta, sve karte na broju); component testovi za `PaymentDecision`/`Decision`; Playwright skripte u CI; snapshot `summarize()` izlaza za migraciju save-a.
- **Trud:** M.

### P3.4 Sigurnosni i web detalji

- CSP, `X-Content-Type-Options`, `Referrer-Policy` kroz `vercel.json`; Open Graph/Twitter meta (danas dijeljeni link nema sliku); `manifest.json` + service worker za instalaciju i offline igru (karte su lokalne, engine ne treba mrežu); `robots.txt`.
- **Trud:** S.

### P3.5 Dokumentacija

- `ARCHITECTURE.md` (engine → review → UI, gdje šta živi), obrazac za pisanje skripte karte, `progress.md` pretvoriti u kratak CHANGELOG (sada je dnevnik od 156 linija u kojem se teško nađe stanje).
- **Trud:** S.

## Predloženi redoslijed

1. **Faza 1 (stabilnost):** P0.3 CI → P0.4 error boundary → P0.5 keširanje → P0.2 nalozi → P0.1 tempo.
2. **Faza 2 (iskustvo):** P1.1 → P1.2 → P1.5 undo → P1.7 kraj misije → P2.1 Heroic/seed.
3. **Faza 3 (dubina):** P1.4 bot i savjeti → P1.3 tutorijal → P2.4 deck builder → P1.6 mobilni (odluka o obimu).
4. **Faza 4 (širenje):** P3.1 podjela fajlova → P2.2 refaktor enginea → prva ekspanzija → P2.3 ljestvica → P2.5 online co-op.

Trud: S = do jednog dana rada, M = 2–5 dana, L = 1–3 sedmice, XL = više od mjesec dana. P3.2–P3.5 se ubacuju usput, bez blokiranja faza.

## Šta se ne preporučuje

- Automatsko odigravanje bez kontrole igrača (tajmeri): ranije izričito odbijeno; tempo iz P0.1 to poštuje jer i dalje staje na svemu bitnom.
- Generisanje novih AI ilustracija karata: pravna i estetska granica; koristiti isključivo zvanične skenove kao do sada.
- Ekspanzije prije P2.2/P3.1: svaka bi udvostručila već prevelike fajlove.
