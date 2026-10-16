import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const output = process.env.ACOLYTES_OUTPUT || "output/acolytes/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch} from './src/game/engine.ts';
import {seatView} from './src/game/team.ts';
export function fixture(kind){
 let s=newGame({heroId:'spider_man',aspect:'justice',heroes:[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}],villainId:'rhino',module:'acolytes',seed:321590,pacing:'expert'});
 for(let n=0;n<2;n++)s=dispatch(s,{type:'MULLIGAN',ids:[]});
 if(s.prompt||s.review||s.error)throw Error('Unexpected setup');
 for(const seat of s.players){const p=seatView(s,seat).player;p.form='hero';p.hp=100;p.deck.push(...p.hand);p.hand=[];}
 s.villain.hp=s.villain.maxHp=100;s.villain.tough=false;s.villain.toughCards=0;
 const originals=s.encounter.deck.filter(p=>p.code>='32159'&&p.code<='32165').map(p=>({id:p.id,code:p.code}));
 const take=code=>{const n=s.encounter.deck.findIndex(p=>p.code===code);if(n<0)throw Error('Missing '+code);return s.encounter.deck.splice(n,1)[0]};
 const put=(code,seat='p1')=>{const p=take(code);p.engagedWith=seat;s.minions.push(p);return p;};
 let effect;
 if(kind==='teamwork'){put('32161');effect={type:'reveal',piece:take('32160'),actorId:'p2'};}
 if(kind==='zeal'){put('32160');put('32161');effect={type:'reveal',piece:take('32164'),actorId:'p1'};}
 if(kind==='fabian'){const p=put('32159');s.encounter.deck.unshift(take('32161'));effect={type:'damage',target:p.id,amount:4,source:'hero',actorId:'p1'};}
 if(kind==='guard'){put('32160');effect={type:'reveal',piece:take('32165'),actorId:'p1'};}
 if(!effect)throw Error('Unknown fixture');
 if(effect.piece)s.resolving.push(effect.piece);
 s.prompt={kind:'choice',title:'Acolytes source fixture',text:'Resolve the original encounter card.',options:[{id:'resolve',label:'Resolve original card',effects:[effect]}]};
 return {state:s,originals};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixture } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const browser = await chromium.launch({ headless: true });
const reports = [],
  errors = [];
let pins = process.env.ACOLYTES_EXPECTED_ASSETS
  ? JSON.parse(await readFile(process.env.ACOLYTES_EXPECTED_ASSETS, "utf8"))
  : undefined;
async function proof(page) {
  const urls = await page
    .locator(
      'script[type="module"][src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]',
    )
    .evaluateAll((nodes) =>
      nodes
        .map((n) => n.src || n.href)
        .filter((x) =>
          /\/assets\/(index-.*\.(js|css)|core-cards-.*\.js)$/.test(x),
        ),
    );
  assert.equal(urls.length, 3, "Built production entry, CSS and source data");
  const result = [];
  for (const asset of urls) {
    const res = await page.request.get(asset);
    assert.equal(res.status(), 200);
    result.push({
      name: new URL(asset).pathname,
      sha256: createHash("sha256")
        .update(await res.body())
        .digest("hex"),
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  if (pins) assert.deepEqual(result, pins, "Same frozen assets");
  else pins = result;
}
async function saved(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("champions.save.v1")),
  );
}
function conserve(s, f) {
  const pieces = [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.minions,
    ...s.sideSchemes,
    ...s.resolving,
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ];
  for (const original of f.originals) {
    assert.equal(
      pieces.filter((p) => p.id === original.id).length,
      1,
      original.id,
    );
    assert.equal(pieces.find((p) => p.id === original.id).code, original.code);
  }
  assert.equal(
    pieces.filter((p) => p.code >= "32159" && p.code <= "32165").length,
    7,
  );
}
try {
  for (const width of [1440, 1280, 390, 320])
    for (const kind of ["teamwork", "zeal", "fabian", "guard"]) {
      const f = fixture(kind),
        context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.addInitScript((state) => {
        if (sessionStorage.getItem("acolytes-loaded")) return;
        sessionStorage.setItem("acolytes-loaded", "1");
        localStorage.setItem("champions.save.v1", JSON.stringify(state));
        localStorage.setItem("champions.sound", "off");
        localStorage.setItem("champions.pacing", "expert");
      }, f.state);
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      assert.equal(res.status(), 200);
      await proof(page);
      await page.getByRole("button", { name: /Resume mission/ }).click();
      for (let n = 0; n < 120; n++) {
        const s = await saved(page);
        assert.ok(!s.error, s.error);
        conserve(s, f);
        if (s.review) {
          await page
            .getByRole("button", { name: "Proceed", exact: true })
            .click();
          continue;
        }
        if (!s.prompt) break;
        const i = s.prompt.options.findIndex((o) =>
          /^(resolve|take|allow|skip|pass|none|no|continue)$/.test(o.id),
        );
        await page.mouse.move(4, 4);
        await page
          .locator(".decision-option")
          .nth(i < 0 ? 0 : i)
          .click();
      }
      const s = await saved(page);
      assert.equal(s.prompt, null);
      conserve(s, f);
      const player = (id) => s.players.find((p) => p.id === id).player;
      // Active seat lives in s.player until synchronization; persisted seats are native.
      if (kind === "teamwork") {
        assert.equal(player("p1").hp, 100);
        assert.equal(player("p2").hp, 99);
      }
      if (kind === "zeal") {
        assert.equal(player("p1").stunned, true);
        assert.equal(player("p1").confused, true);
        assert.equal(s.minions.length, 2);
      }
      if (kind === "fabian") {
        assert.ok(s.encounter.discard.some((p) => p.code === "32159"));
        assert.ok(s.minions.some((p) => p.code === "32161"));
        assert.equal(player("p1").hp, 100);
      }
      if (kind === "guard") {
        assert.ok(s.sideSchemes.some((p) => p.code === "32165"));
        assert.ok(
          (await page.locator(".scheme-hazard").count()) ||
            s.sideSchemes.length,
        );
      }
      await page.mouse.move(4, 4);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images]
            .filter((i) => i.getClientRects().length && i.loading !== "lazy")
            .map((i) => i.decode()),
        );
      });
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scroll <= width + 1, JSON.stringify(dimensions));
      await page.evaluate(
        await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
      );
      const violations = await page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
      assert.deepEqual(violations, []);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Resume mission/ }).click();
      conserve(await saved(page), f);
      await proof(page);
      reports.push({
        kind,
        width,
        originalCards: 7,
        dimensions,
        violations,
        reload: true,
      });
      await context.close();
    }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ url, pins, reports, errors }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      checks: reports.length,
      accessibility: reports.length,
      layout: reports.length,
      errors,
      pins,
    }),
  );
} catch (e) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      { message: e.message, stack: e.stack, errors, reports },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
