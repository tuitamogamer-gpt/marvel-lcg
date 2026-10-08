import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "output/armadillo";
await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch} from './src/game/engine.ts';
export function fixture(kind){
 let s=newGame({heroId:'nova',aspect:'aggression',villainId:'rhino',module:'armadillo',seed:28029,pacing:'expert'});
 s=dispatch(s,{type:'MULLIGAN',ids:[]});while(s.review)s=dispatch(s,{type:'PROCEED'});
 s.player.form='hero';s.queue=[];s.review=null;s.prompt=null;
 if(kind==='stage'||kind==='victory'){s.villain.hp=1;if(kind==='victory')s.villain.stage=2;s.prompt={kind:'choice',title:'Resolve milestone',text:'Resolve native damage.',options:[{id:'go',label:'Continue',effects:[{type:'damage',target:s.villain.id,amount:2}]}]};}
 else if(kind==='defeat'){s.player.hp=1;s.prompt={kind:'choice',title:'Resolve milestone',text:'Resolve native damage.',options:[{id:'go',label:'Continue',effects:[{type:'damage',target:'hero',amount:2}]}]};}
 else if(kind.startsWith('arm-')){
 const code={'arm-rollin':'28030','arm-assault':'28028','arm-tough':'28032','arm-tumble':'28031'}[kind];
 const i=s.encounter.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Actual Armadillo source required');
 const p=s.encounter.deck.splice(i,1)[0];s.resolving.push(p);
 if(kind==='arm-tumble')s.villain.tough=true;
 s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve actual Armadillo card.',options:[{id:'go',label:'Continue',effects:[{type:'reveal',piece:p,skip:true}]}]};
 }else {s.prompt={kind:'choice',title:'Resolve milestone',text:'Resolve ordinary damage.',options:[{id:'go',label:'Continue',effects:[{type:'damage',target:s.villain.id,amount:1}]}]};}
 return s;
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixture } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const browser = await chromium.launch();
const checks = [],
  errors = [];
try {
  for (const width of [1440, 1280, 390, 320])
    for (const kind of [
      "stage",
      "victory",
      "defeat",
      "ordinary",
      "arm-rollin",
      "arm-assault",
      "arm-tough",
      "arm-tumble",
    ])
      for (const reducedMotion of ["no-preference", "reduce"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion,
        });
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript((s) => {
          if (sessionStorage.getItem("fixture")) return;
          sessionStorage.setItem("fixture", "1");
          localStorage.setItem("champions.save.v1", JSON.stringify(s));
          localStorage.setItem("champions.sound", "off");
          localStorage.setItem("champions.pacing", "expert");
        }, fixture(kind));
        await page.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
        await page.getByRole("button", { name: /Resume mission/ }).click();
        assert.equal(
          await page.locator(".milestone-animation").count(),
          0,
          "Resume does not replay",
        );
        await page.locator(".decision-option").first().click();
        if (["stage", "victory", "defeat"].includes(kind)) {
          await page.locator(".milestone-animation").waitFor();
          await page.waitForTimeout(350);
          const text = await page.locator(".milestone-title").innerText();
          assert.equal(
            text,
            kind === "stage"
              ? "NEXT STAGE"
              : kind === "defeat"
                ? "MISSION ENDED"
                : "VICTORY!",
          );
          assert.equal(
            await page
              .locator(".milestone-animation")
              .evaluate((e) => getComputedStyle(e).pointerEvents),
            "none",
          );
          await page.screenshot({
            path:
              out +
              "/motion-" +
              kind +
              "-" +
              width +
              "-" +
              reducedMotion +
              ".png",
          });
          await page
            .locator(".milestone-animation")
            .waitFor({ state: "detached", timeout: 4000 });
        } else {
          await page.waitForTimeout(500);
          assert.equal(await page.locator(".milestone-animation").count(), 0);
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "No horizontal overflow",
        );
        for (let n = 0; n < 50; n++) {
          const state = await page.evaluate(() =>
            JSON.parse(localStorage.getItem("champions.save.v1")),
          );
          assert.ok(!state.error, state.error);
          if (state.review) {
            await page
              .getByRole("button", { name: "Proceed", exact: true })
              .click();
            continue;
          }
          if (state.prompt) {
            const i = Math.max(
              0,
              state.prompt.options.findIndex((o) =>
                ["pass", "skip", "take", "resolve", "continue"].includes(o.id),
              ),
            );
            await page.locator(".decision-option").nth(i).click();
            continue;
          }
          if (kind === "arm-rollin") {
            assert.ok(state.attachments.some((p) => p.code === "28030"));
            assert.ok(state.minions.some((p) => p.code === "28029"));
          }
          if (kind === "arm-assault")
            assert.ok(state.sideSchemes.some((p) => p.code === "28028"));
          if (kind === "arm-tough") assert.ok(state.villain.tough);
          break;
        }
        await page.reload();
        const resume = page.getByRole("button", { name: /Resume mission/ });
        if (await resume.count()) await resume.click();
        assert.equal(
          await page.locator(".milestone-animation").count(),
          0,
          "Reload does not replay",
        );
        checks.push({ width, kind, reducedMotion });
        await context.close();
      }
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/motion-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(checks.length + " milestone browser checks passed");
} finally {
  await browser.close();
}
