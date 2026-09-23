# Audit enginea i pravila — core set

Datum: 23.09.2026. Pregledani commit: `d05b2b15383cf800f4e6e8afbe08f89d63b22452`.

**Početni nalaz na pregledanom commitu: engine je odstupao od pravila u više situacija koje mijenjaju ishod partije.** Postojećih 118 testova prolazi. Dodatni audit obuhvata 51 ciljano odabran scenario: 12 prolazi, a 39 pokazuje odstupanja, grupisana u 25 nalaza ispod. Nijedan scenario nije završio greškom audit skripte. Ovo je skup testova sumnjivih interakcija, a ne reprezentativan uzorak niti procenat ispravnosti svih partija.

**Status nakon odobrenih popravki:** svih 25 grupa nalaza ispod je popravljeno. Svih 51 originalnih scenarija sada prolazi u redovnom test suiteu. Dodate su još 36 provjera nastavka efekata, rubnih interakcija i save/resume ponašanja; ukupno 205 testova prolaze. Detalji ispod čuvaju početne nalaze i lokacije u auditovanom commitu; nisu opis trenutnog ponašanja. Izolovani JSON/log predstavljaju početni audit, a aktuelni dokaz je `tests/rules-v18.test.ts`.

## Izvori i metoda

- Aktuelni izvor je [FFG Rules Reference 1.8](https://images-cdn.fantasyflightgames.com/filer_public/ee/30/ee304242-73cd-4f70-bcdd-b904a5fecad5/mc_rulesreference_v18_compressed.pdf), preuzet sa zvanične stranice igre. Oznake „RRG” i brojevi stranica u tabelama odnose se na taj PDF.
- [FFG: Mission Updates, 23.07.2026.](https://www.fantasyflightgames.com/en/news/2026/7/23/mission-updates/) objašnjava izmjene za Surge, Overkill, timing i Iron Man erratu. Dokumentacija projekta je u vrijeme audita navodila 1.7; sada je ažurirana na 1.8.
- Pregledani su centralni tokovi u `src/game/engine.ts`, `cards.ts`, `payment.ts`, `team.ts`, postojeći testovi i tekstovi core karata iz lokalne baze. Broj od 209 lica karata nije broj pojedinačno sertifikovanih interakcija.
- Novi scenariji koriste pravi `dispatch`, handler efekte i objekte iz enginea. Fixture postavlja usko definisanu situaciju, poput napada na posljednji HP allyja; ne pokreće punu partiju za svaki nalaz. Nema mockovanih rezultata pravila. To je dodatak postojećim seeded simulacijama, a ne zamjena za njih.
- [Rezultati sa expected/actual vrijednostima](/Users/borislavvukojevic/Downloads/marvel-lcg/output/rules-audit/results.json), [izvršiva audit skripta](/Users/borislavvukojevic/Downloads/marvel-lcg/output/rules-audit/run-audit.ts) i [log](/Users/borislavvukojevic/Downloads/marvel-lcg/output/rules-audit/run.log) ostaju lokalno u `output/rules-audit/`.

## P1 — prvo popraviti

Ovi nalazi utiču na osnovne keyworde, štetu, vlasništvo/stanje karata ili redoslijed rješavanja. Lokacije su u [engine.ts](/Users/borislavvukojevic/Downloads/marvel-lcg/src/game/engine.ts), osim gdje je posebno navedeno.

| # | Nalaz i dokaz | Lokacija | Scenariji / izvor |
|---|---|---|---|
| 1 | **Surge koristi stari model.** U player fazi odmah otkriva novu kartu; u villain fazi preskače već podijeljene encounter karte. Enhanced Spider-Sense i dalje propušta printed Surge. Izmjeren redoslijed: Exhaustion → I'm Tough → False Alarm; očekivano: Exhaustion → False Alarm → I'm Tough. Potrebni su podjela facedown karte na kraj reda i pravilno poništavanje njenog When Revealed efekta. | 2386, 2446, 3362 | S01–S03; RRG 42; FFG Mission Updates |
| 2 | **Toughness nije obrada ulaska u igru.** Armored Guard ulazi bez Tough jer tekst počinje sa Guard. Luke Cage nakon napuštanja igre i ponovnog običnog igranja takođe ulazi bez Tough. `startsWith` i inicijalizacija samo pri kreiranju objekta ne pokrivaju ove slučajeve. | 98, 1123 | K01, K11; RRG 45 |
| 3 | **Minion pamti prethodni život.** Poslije poraza i ponovnog reveal-a Armored Guard zadržava 5 damage, Stunned, Confused i engagement sa p1, iako ga sada otkriva p2. Potreban je reset pri napuštanju igre i novi engagement pri ulasku. | 227, 1829, 2290 | K03; RRG 18, 27 |
| 4 | **Tough se zaobilazi u dva toka.** Backflip se nudi prije Tougha; Luke Cage dobija consequential damage dok mu Tough ostaje. U testu: damage 1/Tough true umjesto damage 0/Tough false. | 2989, 3199 | K04, K10; RRG 44, 57 |
| 5 | **Quickstrike je vezan samo za reveal.** Vulture koji ulazi kroz `findMinion` ne napada heroja. Provjera je u jednom card handleru umjesto u zajedničkom engagement toku. | 2312, 3368, 3390 | K02; RRG 18, 36 |
| 6 | **Retaliate zavisi od pogrešnih ranih izlaza.** Armored Rhino Suit i Biomechanical Upgrades preskaču retaliate. Obrnuto, Black Panther koji je upravo eliminisan u multiplayeru ipak uzvraća štetu. | 385, 2125 | K05, K12, C22; RRG 38 |
| 7 | **Guard ne važi za svaki napad.** Counter-Punch protiv villaina ostaje ponuđen kada igrač ima engaged Guard miniona; direktna putanja preskače izbor i validaciju mete. | 3285, 788 | K06; RRG 10, 21 |
| 8 | **Nestali defender poništava štetu.** Black Cat sa 1 preostalim HP brani; Concussive Blast boost je porazi. Rhino zatim ne ošteti heroja: završava na 9 HP umjesto 7. Attack target ostaje ID uklonjenog allyja. | 2125 | C01; RRG 9 |
| 9 | **Dodatni scheme boost se gubi.** Titania's Fury boost tokom Rhino scheme aktivacije ne dodaje sljedeći boost. Izmjereno 2 threat umjesto 4 uz unaprijed određene karte. Handler radi samo dok postoji `s.attack`. | 1975, 2045 | C02; RRG 11, 39; Core #164 |
| 10 | **Ultron II ima pogrešan timing i zamrznut ATK.** Hawkeye prozor za novi drone dolazi tek iza napada. Drone dodat Android Efficiency boostom ne povećava već izračunati ATK: heroj ostaje na 7 HP umjesto 6. | 1829, 1851, 2125 | C03, C23; RRG 9, 25, 58 |
| 11 | **Karte prerano ulaze u discard.** Ancestral Knowledge može izabrati sam sebe dok se još rješava. Assault je u encounter discardu prije završetka svog napada i može ući u prerani reshuffle. | 1123, 1233, 2382 | C07, C08; RRG 18, 38, 58 |
| 12 | **Draw, discard i look dijele pogrešan tok.** Discard 5 sa jednom preostalom kartom nastavlja poslije reshufflea. `findMinion` nastavlja u tek promiješan encounter deck. Futurist sa jednom kartom u decku nudi tri karte iz dvije generacije špila. | 167, 178, 195, 206, 1556, 3390 | C09–C11; RRG 17, 27, 33 |
| 13 | **Promjene limita i HP ne pokreću punu provjeru stanja.** Bez Triskeliona ostaju četiri allyja bez izbora discard-a. Uklanjanje Upgraded Drones ostavlja drone sa 1 damage i 1 ukupnim HP u igri. | 227, 285, 2702 | C12, C21; RRG 7, 15, 22 |
| 14 | **Troškovi sposobnosti mogu biti preskočeni.** Focused Rage kroz Tough ipak exhaustuje kartu i vuče kartu. Legal Practice uklanja Confused bez plaćanja dodatnog discard troška. | 1123, 1281, 1658, 2878 | C04, C14; RRG 13–14, 57 |

## P2 — kartične i legalne opcije

| # | Nalaz i dokaz | Lokacija | Scenariji / izvor |
|---|---|---|---|
| 15 | **Confused bez mete ostaje zaglavljen.** Basic thwart na praznim schemeovima vraća „There are no eligible targets”, umjesto da exhaustuje heroja i ukloni Confused. | 3949 | K07; RRG 13, 44 |
| 16 | **Vision ima izmišljen exhaust uslov.** Density Control je zaključan kada je Vision exhausted, iako njegova sposobnost troši samo resurs. | 1442 | C05; RRG 19; Core #68 |
| 17 | **Superhuman Strength se nepotrebno gubi.** Poslije napada na već Stunned Rhino engine odbacuje upgrade. Stun efekat u ovoj situaciji nema validnu promjenu. | 788 | C06; RRG 57 |
| 18 | **Spider-Tracer dobija nepostojeći limit.** Drugi primjerak na istom minionu biva odbačen. Zajednički `attachPlayer` primjenjuje isti limit na sve podržane attach upgradeove. | 2815 | C13; Core #7, #9, #74 |
| 19 | **Hero i alter-ego mete se miješaju.** Sweeping Swoop stunnuje alter-ego; Under Attack mu nudi hero-only damage opciju. `target: "hero"` je u ovim putanjama samo alias za trenutno aktivni identity. | 2596, 3721 | C15, C16; RRG 12, 21; Core #151, #168 |
| 20 | **Stunned napad ne pokreće fallback.** Stunned Titania zadrži 3 damage umjesto da se izliječi poslije Titania's Fury. Stunned drone ne proizvede novi drone kroz Swarm Attack. Handler gleda postojanje napadača, ne rezultat aktivacije. | 2547, 2587 | C17, C18; RRG 41; Core #147, #164 |
| 21 | **Enhanced Spider-Sense ne može pomoći saigraču.** Spider-Man ima kartu i resurs, ali nema opciju da poništi treachery koju je otkrio drugi heroj. | 2224 | C19; Core #4 |
| 22 | **Dodatni threat zaobilazi I Object.** Breakin' & Takin' direktno povećava counters i ne otvara interrupt. Početni threat i dodatni When Revealed threat moraju ostati odvojene operacije. | 2318 | C20; RRG 57; Core #107 |
| 23 | **Cosmic Flight štiti samo od napada.** Kod običnog damage efekta nema opcije za prevent 3; karta provjerava damage prozor šire od toga. | 385, 3199 | C24; RRG 16; Core #17 |
| 24 | **Crisis Interdiction zanemaruje uslov „then”.** Prva meta ima samo 1 threat, ali druga ipak izgubi 2. U testu side scheme završi na 1 umjesto na 3. | 2924 | C25; RRG 44; Core #12 |
| 25 | **First Aid ima preusku metu.** Oštećeni villain nije ponuđen; lokalni tekst core karte dozvoljava bilo koji character, a handler koristi `friendly`. | 1408 | C26; Core #86 |

## Errata i provjere koje prolaze

| Stavka | Rezultat |
|---|---|
| Superhuman Law Division | Errata bez thwart oznake već je u podacima i ponašanju. U testu uklanja threat i ostavlja Confused. |
| Iron Man | Tekst u `src/data/core-player.json:640` još koristi stari ukupni limit od 7. Errata ograničava bonus na +6. Core-only rezultat od 7 trenutno je dobar; generički model dodatnih hand-size modifikatora i ažuriran tekst nisu uvedeni. |
| The Doomsday Chair / M.O.D.O.K. | Ispravljena interpunkcija naziva je prisutna. |

Izvor za ovu tabelu: RRG 1.8, str. 65; [FFG objašnjenje Iron Man izmjene](https://www.fantasyflightgames.com/en/news/2026/7/23/mission-updates/).

Dodatnih 12 uspješnih scenarija provjerava: normalni Overkill; Overkill naspram Tough; Superhuman Law Division/Confused; dvije Pepper Potts kombinacije; ne-attack damage mimo Guarda; prioritet Stunned prije Webbed Up; core Iron Man hand size; posljednji Uses counter na Tac Teamu; Tigra healing prije consequential damage; Energy Daggers kao ne-attack efekat; i Power of Leadership pri plaćanju allyja kroz Make the Call. To su konkretne prolazne provjere, ne sertifikacija cijelog keyworda.

## Redoslijed popravki

1. Uvesti zajedničke operacije ulaska/izlaska karte, reset stanja i provjeru poraza/limita. Time se pokrivaju Toughness, vraćeni minioni, engagement, uklonjeni HP bonusi i Triskelion.
2. Urediti attack i damage tok: izgubljeni defender, aktuelni ATK/DEF, originalni target, Tough prioritet, retaliation i boostovi za obje vrste aktivacije.
3. Razdvojiti resolution zonu, draw/discard/look i encounter red. Uvesti Surge 1.8 kroz podjelu karte na kraj reda.
4. Centralizovati provjeru mete, cijene i response/interrupt prozora; zatim doraditi pojedinačne kartične slučajeve i errata tekst.
5. Svaki popravljeni audit scenario pretvoriti u redovan regresioni test. Zadržati vidljive Proceed preglede efekata i trenutan obični flip u hero formu.

## Reprodukcija

Iz korijena projekta:

```sh
npm test
npx esbuild output/rules-audit/run-audit.ts --bundle --platform=node --format=esm --outfile=output/rules-audit/run-audit.mjs
node output/rules-audit/run-audit.mjs
```

Skripta prijavljuje `PASS`, `MISMATCH` ili `ERROR` i piše JSON sa expected/actual vrijednostima. Exit code 0 znači da je audit skripta izvršena; ne znači da su pravila prošla. Trenutni rezultat je 51 scenario, 12 PASS, 39 MISMATCH, 0 ERROR.

Ovo nije iscrpan dokaz svih mogućih kombinacija. Poznata ograničenja iz `docs/rules-coverage.md` ostaju relevantna: opšti redoslijed/nesting response prozora, automatske opcione sposobnosti, namjerni neuspjeh searcha, slobodna promjena forme kod obligationa i izbor između vezanih meta. Nisu izvršene izmjene produkcijskog koda niti novi deploy u okviru ovog audita.

## Implementirane popravke

- Nalazi 1–14: popravljeni zajednički tokovi ulaska/izlaska, defeat/limit provjere, attack/scheme boostovi, target i status prioriteti, resolving zona, pražnjenje špilova, Surge 1.8 i dodatni troškovi.
- Nalazi 15–25: popravljene sve navedene kartične interakcije i legalne opcije.
- Iron Man koristi limit bonusa +6; ažurirani tekst i Surge podsjetnici imaju referencu na FFG u prikazu karte. Originalne slike i preuzeti podaci ostaju dostupni.
- Novi testovi provjeravaju i oba redoslijeda Under Fire efekata, više Spider-Tracera, Quickstrike prije Hawkeyeja, Retaliate prije consequential damage, odbranu saigrača, sačuvane boostove i konačnu računicu prije Proceed.
- Sačuvani su vidljivi izbori, plaćanje slikama karata i obični hero flip bez dodatne potvrde. Granice opšteg timing frameworka navedene su u `rules-coverage.md`.

Aktuelna reprodukcija: `npm test` ili `npx vitest run tests/rules-v18.test.ts`.
