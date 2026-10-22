import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.AUDIO_OUTPUT || "output/audio/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const ignoreHTTPSErrors = process.env.AUDIO_IGNORE_HTTPS_ERRORS === "1";
const widths = (process.env.AUDIO_VIEWPORTS || "1920,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(widths.length && widths.every((width) => width >= 320));
const kinds = ["victory", "defeat", "stage", "upgrade"];
const assets = kinds.map((kind) => `/audio/milestones/${kind}.mp3`);
await mkdir(output, { recursive: true });
for (const name of ["report.json", "failure.json", "failure.png"])
  await rm(`${output}/${name}`, { force: true });

// Fixtures retain the complete original starter and physical Ironheart forms.
// Browser commands resolve native damage or the actual Level Up ability.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {syncSeat} from './src/game/team.ts';
export function fixture(kind){
 const heroId=kind==='upgrade'?'ironheart':'nova';
 const aspect=heroId==='ironheart'?'leadership':'aggression';
 let s=newGame({heroId,aspect,heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],villainId:'rhino',module:'armadillo',seed:28029,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;s.phase==='mulligan'&&n<10;n++){if(s.prompt)throw Error('Unexpected setup prompt');command({type:'MULLIGAN',ids:[]});}
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native setup incomplete');
 const source=[...s.player.hand,...s.player.deck,...s.player.discard,...s.player.inPlay].map(p=>({id:p.id,code:p.code}));
 const identities=[...(s.player.ironheartIdentity?[s.player.ironheartIdentity]:[]),...(s.player.setAside||[]).filter(p=>/^2900[23]a$/.test(p.code))].map(p=>({id:p.id,code:p.code}));
 s.player.form='hero';s.player.exhausted=false;s.player.flipped=false;s.queue=[];s.prompt=null;s.review=null;
 if(kind==='upgrade')s.player.ironheartIdentity.counters=12;
 else{
  if(kind==='stage'||kind==='victory'){s.villain.hp=1;if(kind==='victory'){s.villain.stage=2;s.villain.code='01095';}}
  else if(kind==='defeat')s.player.hp=1;
  const effect=kind==='defeat'?{type:'damage',target:'hero',amount:2}:{type:'damage',target:s.villain.id,amount:kind==='ordinary'?1:2};
  s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve native damage.',options:[{id:'go',label:'Continue',effects:[effect]}]};
 }
 syncSeat(s);return{state:s,source,sourceCodes:heroStarterCodes(heroId),identities};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture } = await import(pathToFileURL(fixturePath).href);

function conserved(state, original, label) {
  const nested = (piece) => [
    piece,
    ...(piece.storedCards || []).flatMap(nested),
    ...(piece.captured || []).flatMap(nested),
  ];
  const player = state.player;
  const pieces = [
    ...player.hand,
    ...player.deck,
    ...player.discard,
    ...player.inPlay,
    ...(player.setAside || []),
    ...(player.ironheartIdentity ? [player.ironheartIdentity] : []),
    ...state.resolving,
    ...state.removed,
    ...state.attachments,
  ].flatMap(nested);
  assert.equal(original.source.length, 40, `${label}: original forty cards`);
  assert.deepEqual(
    original.source.map((piece) => piece.code).sort(),
    [...original.sourceCodes].sort(),
    `${label}: exact original starter`,
  );
  for (const source of [...original.source, ...original.identities]) {
    const matches = pieces.filter((piece) => piece.id === source.id);
    assert.equal(matches.length, 1, `${label}: unique physical ${source.id}`);
    assert.equal(matches[0].code, source.code, `${label}: original printing`);
  }
}

if (process.env.AUDIO_FIXTURE_CHECK === "1") {
  const prepared = [...kinds, "ordinary"].map((kind) => {
    const original = fixture(kind);
    conserved(original.state, original, kind);
    return {
      kind,
      sourceCards: original.source.length,
      reservedIdentityFaces: original.identities.length,
    };
  });
  await writeFile(
    `${output}/fixture-preparation.json`,
    JSON.stringify(
      { preparationOnly: true, audioPlaybackVerified: false, prepared },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ preparationOnly: true, fixtures: prepared.length }),
  );
  process.exit(0);
}

// Observe real browser audio without replacing playback, decoding, or fetch.
// ArrayBuffer -> AudioBuffer provenance links each started sound to its URL.
function installAudioProbe() {
  const decoded = [],
    started = [],
    stopped = [],
    ended = [],
    gains = [],
    visibility = [];
  const sourceUrls = new WeakMap();
  const bufferUrls = new WeakMap();
  const sourceGains = new WeakMap();
  const connectedOutputs = new WeakSet();
  let nextSource = 0;
  const responseArrayBuffer = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function (...args) {
    const data = await Reflect.apply(responseArrayBuffer, this, args);
    if (/\/audio\/milestones\/[^/]+\.mp3(?:\?|$)/.test(this.url))
      sourceUrls.set(data, new URL(this.url).pathname);
    return data;
  };
  const contextPrototype = BaseAudioContext.prototype;
  const gainConnect = GainNode.prototype.connect;
  GainNode.prototype.connect = function (...args) {
    const result = Reflect.apply(gainConnect, this, args);
    if (args[0] === this.context.destination) connectedOutputs.add(this);
    return result;
  };
  const gainDisconnect = GainNode.prototype.disconnect;
  GainNode.prototype.disconnect = function (...args) {
    const result = Reflect.apply(gainDisconnect, this, args);
    if (
      !args.length ||
      args[0] === this.context.destination ||
      typeof args[0] === "number"
    )
      connectedOutputs.delete(this);
    return result;
  };
  const decode = contextPrototype.decodeAudioData;
  contextPrototype.decodeAudioData = function (...args) {
    const path = sourceUrls.get(args[0]);
    const result = Reflect.apply(decode, this, args);
    result.then(
      (buffer) => {
        if (!path) return;
        bufferUrls.set(buffer, path);
        decoded.push({
          path,
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
        });
      },
      () => {},
    );
    return result;
  };
  const createSource = contextPrototype.createBufferSource;
  contextPrototype.createBufferSource = function (...args) {
    const source = Reflect.apply(createSource, this, args);
    const context = this;
    const id = ++nextSource;
    const connect = source.connect;
    source.connect = function (...connections) {
      if (connections[0] instanceof GainNode)
        sourceGains.set(source, connections[0]);
      return Reflect.apply(connect, this, connections);
    };
    const start = source.start;
    source.start = function (...times) {
      const result = Reflect.apply(start, this, times);
      started.push({
        id,
        path: bufferUrls.get(source.buffer) || null,
        duration: source.buffer?.duration,
        contextState: context.state,
        volume: sourceGains.get(source)?.gain.value,
        outputConnected: connectedOutputs.has(sourceGains.get(source)),
        time: performance.now(),
      });
      return result;
    };
    const stop = source.stop;
    source.stop = function (...times) {
      const result = Reflect.apply(stop, this, times);
      stopped.push({ id, time: performance.now() });
      return result;
    };
    source.addEventListener("ended", () =>
      ended.push({ id, time: performance.now() }),
    );
    return source;
  };
  const setTarget = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (...args) {
    const result = Reflect.apply(setTarget, this, args);
    gains.push({ value: args[0], time: performance.now() });
    return result;
  };
  document.addEventListener("visibilitychange", () =>
    visibility.push({
      state: document.visibilityState,
      time: performance.now(),
    }),
  );
  window.__milestoneAudioProbe = {
    snapshot: () => ({ decoded, started, stopped, ended, gains, visibility }),
  };
}

const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const checks = [],
  audits = [],
  layouts = [],
  errors = [],
  assetProofs = [],
  entryProof = [],
  responseTasks = [];
const entries = new Set();
let context, page, current;
const probe = () =>
  page.evaluate(() => window.__milestoneAudioProbe.snapshot());
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));

async function open(kind, width, reducedMotion = "reduce", enabled = false) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion,
    ignoreHTTPSErrors,
  });
  page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    const isEntry = /\/assets\/index-[^/]+\.js$/.test(path);
    if (!assets.includes(path) && !isEntry) return;
    const task = (async () => {
      const bytes = await response.body();
      (isEntry ? entryProof : assetProofs).push({
        path,
        status: response.status(),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    })();
    responseTasks.push(task);
    task.catch((error) => errors.push(`Audio response: ${error.message}`));
  });
  const original = fixture(kind);
  conserved(original.state, original, "prepared source");
  await page.addInitScript(installAudioProbe);
  await page.addInitScript(
    ({ state, enabled }) => {
      if (sessionStorage.getItem("audio-fixture-loaded")) return;
      sessionStorage.setItem("audio-fixture-loaded", "yes");
      localStorage.setItem("champions.save.v1", JSON.stringify(state));
      localStorage.setItem("champions.pacing", "expert");
      if (enabled) localStorage.setItem("champions.sound", "on");
      else localStorage.removeItem("champions.sound");
      localStorage.removeItem("champions.sound.volume");
    },
    { state: original.state, enabled },
  );
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entries.add(src);
  assert.ok(entries.size <= 1, "One immutable production entry");
  if (process.env.AUDIO_ASSET) {
    assert.equal(entries.size, 1, "Production entry is loaded");
    assert.ok(
      [...entries].every((asset) => asset.endsWith(process.env.AUDIO_ASSET)),
      "Expected production entry is loaded",
    );
  }
  assert.deepEqual((await probe()).started, [], "No autoplay on page load");
  assert.deepEqual((await probe()).decoded, [], "No pre-gesture decode");
  if (!enabled)
    assert.deepEqual((await probe()).decoded, [], "Sound defaults to off");
  conserved(await save(), original, "loaded source");
  return original;
}

async function panel(open = true) {
  const summary = page.locator('[aria-label="Sound settings"]');
  const expanded = await summary.evaluate(
    (element) => element.closest("details")?.open,
  );
  if (expanded !== open) await summary.click();
}

async function enable() {
  await panel();
  await page
    .getByRole("checkbox", { name: "Enable sound", exact: true })
    .check();
  await page.waitForFunction(
    () => window.__milestoneAudioProbe.snapshot().decoded.length === 4,
  );
  const observation = await probe();
  assert.deepEqual(
    observation.decoded.map((entry) => entry.path).sort(),
    [...assets].sort(),
    "A gesture decodes all four real local clips",
  );
  assert.ok(
    observation.decoded.every(
      (entry) => entry.duration > 0 && entry.duration < 8 && entry.channels > 0,
    ),
    "All clips decode to short playable audio",
  );
  assert.deepEqual(
    observation.started,
    [],
    "Enabling does not play old events",
  );
}

async function volume(percent) {
  await panel();
  const slider = page.getByRole("slider", {
    name: "Sound volume",
    exact: true,
  });
  const range = await slider.evaluate((input) => ({
    min: Number(input.min || 0),
    max: Number(input.max || 100),
    step: Number(input.step || 1),
  }));
  assert.equal(range.min, 0);
  assert.equal(range.max, 100);
  assert.ok(range.step > 0);
  await slider.focus();
  await slider.press("Home");
  for (let n = 0; n < Math.round(percent / range.step); n++)
    await slider.press("ArrowRight");
  const value = Number(await slider.inputValue());
  assert.equal(value, Math.round(percent / range.step) * range.step);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.sound.volume")),
    String(value / 100),
    "Keyboard volume changes persist",
  );
  return value / 100;
}

async function trigger(kind) {
  const resume = page.getByRole("button", { name: /Resume mission/ });
  if (await resume.count()) {
    await resume.click();
    assert.deepEqual(
      (await probe()).started,
      [],
      "Resume does not replay audio",
    );
  }
  if (kind === "upgrade")
    await page.getByRole("button", { name: /Level Up!/ }).click();
  else await page.locator(".decision-option").first().click();
}

async function started(kind, count = 1) {
  await page.waitForFunction(
    (count) => window.__milestoneAudioProbe.snapshot().started.length === count,
    count,
  );
  const observation = await probe();
  const latest = observation.started.at(-1);
  assert.equal(latest.path, `/audio/milestones/${kind}.mp3`);
  assert.equal(latest.contextState, "running");
  assert.equal(
    latest.outputConnected,
    true,
    "Native gain connects to the audio destination",
  );
  return observation;
}

async function checkpoint(name, width, original) {
  conserved(await save(), original, name);
  await page.mouse.move(3, 3);
  await page.locator(".card-hover-preview").waitFor({ state: "hidden" });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    sound: [
      ...document.querySelectorAll(".sound-settings, .sound-settings-panel"),
    ]
      .filter(
        (element) =>
          element.checkVisibility({ contentVisibilityAuto: true }) &&
          (element.matches(".sound-settings") ||
            element.closest("details")?.open),
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: element.clientWidth,
          content: element.scrollWidth,
        };
      }),
    sliders: [...document.querySelectorAll('input[type="range"]')]
      .filter(
        (element) =>
          element.checkVisibility({ contentVisibilityAuto: true }) &&
          (!element.closest("details") || element.closest("details").open),
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(metrics.documentWidth <= width + 1, `${name}: no page overflow`);
  assert.ok(
    metrics.sound.every(
      (element) =>
        element.left >= -1 &&
        element.right <= width + 1 &&
        element.content <= element.width + 1,
    ),
    `${name}: sound settings remain within the viewport`,
  );
  assert.ok(
    metrics.sliders.every(
      (slider) => slider.left >= 0 && slider.right <= width + 1,
    ),
    `${name}: volume control remains visible`,
  );
  await page.evaluate(
    await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
  );
  const audit = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  const violations = audit.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      message: node.failureSummary,
    })),
  }));
  audits.push({ name, width, violations });
  assert.deepEqual(violations, [], `${name}: accessible sound/game controls`);
  await page.screenshot({ path: `${output}/${name}-${width}.png` });
}

async function reloadSilent(original, expectedVolume) {
  const before = await save();
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.deepEqual(
    (await probe()).started,
    [],
    "Reload never starts old audio",
  );
  await panel();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Enable sound", exact: true })
      .isChecked(),
    true,
    "Enabled setting survives reload",
  );
  assert.equal(
    Number(
      await page
        .getByRole("slider", { name: "Sound volume", exact: true })
        .inputValue(),
    ),
    expectedVolume * 100,
    "Volume survives reload",
  );
  await page.waitForTimeout(100);
  assert.deepEqual(
    (await probe()).started,
    [],
    "A fresh gesture does not replay",
  );
  await panel(false);
  const resume = page.getByRole("button", { name: /Resume mission/ });
  if (await resume.count()) await resume.click();
  assert.deepEqual((await probe()).started, [], "Resume remains silent");
  assert.deepEqual(await save(), before, "Exact native state survives reload");
  conserved(await save(), original, "reload conservation");
}

try {
  for (const width of widths) {
    for (const kind of kinds) {
      const motions =
        width === widths[0] ? ["reduce", "no-preference"] : ["reduce"];
      for (const reducedMotion of motions) {
        current = { scenario: "milestone", width, kind, reducedMotion };
        const original = await open(kind, width, reducedMotion);
        await enable();
        const gain = await volume(35);
        if (kind === "stage")
          await checkpoint(`sound-panel-${reducedMotion}`, width, original);
        await panel(false);
        await trigger(kind);
        const observation = await started(kind);
        assert.ok(Math.abs(observation.started[0].volume - gain) < 0.001);
        const state = await save();
        assert.ok(!state.error, state.error);
        if (kind === "victory") assert.equal(state.phase, "won");
        else if (kind === "defeat") assert.equal(state.phase, "lost");
        else if (kind === "stage") assert.equal(state.villain.stage, 2);
        else assert.equal(state.player.ironheartIdentity.code, "29002a");
        await page.waitForFunction(
          () => window.__milestoneAudioProbe.snapshot().ended.length >= 1,
        );
        assert.equal(
          (await probe()).started.length,
          1,
          "Exactly one clip per milestone",
        );
        await checkpoint(`${kind}-${reducedMotion}`, width, original);
        await reloadSilent(original, gain);
        checks.push({ ...current, originalPlayerCards: 40, observation });
      }
    }
  }

  // One real command/undo/reload sequence verifies ordinary actions stay quiet.
  current = { scenario: "ordinary-and-undo", width: 1280 };
  let original = await open("ordinary", 1280);
  await enable();
  await panel(false);
  await trigger("ordinary");
  await page.waitForTimeout(150);
  assert.deepEqual((await probe()).started, [], "Ordinary damage has no sound");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(100);
  assert.deepEqual((await probe()).started, [], "Undo does not play a sound");
  await reloadSilent(original, 0.45);
  checks.push({ ...current });

  // Muted events are consumed. Enabling afterward must not replay the event.
  current = { scenario: "muted-milestone", width: 390 };
  original = await open("upgrade", 390);
  await trigger("upgrade");
  await page.waitForTimeout(100);
  assert.deepEqual((await probe()).started, []);
  await enable();
  await page.waitForTimeout(100);
  assert.deepEqual(
    (await probe()).started,
    [],
    "Enabling consumes a previously muted event",
  );
  checks.push({ ...current });

  // Stop a real active source immediately from the mute and navigation controls.
  for (const action of ["mute", "zero-volume", "screen-exit", "undo"]) {
    current = { scenario: `stop-${action}`, width: 1280 };
    original = await open("upgrade", 1280);
    await enable();
    if (action === "mute" || action === "zero-volume") await panel();
    else await panel(false);
    await trigger("upgrade");
    await started("upgrade");
    if (action === "mute" || action === "zero-volume") await panel();
    if (action === "mute")
      await page
        .getByRole("checkbox", { name: "Enable sound", exact: true })
        .uncheck();
    else if (action === "zero-volume") {
      const slider = page.getByRole("slider", {
        name: "Sound volume",
        exact: true,
      });
      await slider.press("ArrowLeft");
      assert.equal(await slider.inputValue(), "44");
      const live = await probe();
      assert.ok(
        live.gains.some((gain) => Math.abs(gain.value - 0.44) < 0.001),
        "Nonzero live volume updates the actual gain",
      );
      assert.equal(
        live.stopped.length,
        0,
        "Nonzero volume keeps the current clip playing",
      );
      await slider.press("Home");
    } else if (action === "screen-exit")
      await page
        .getByRole("button", { name: "Mission control", exact: true })
        .click();
    else await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.waitForFunction(
      () => window.__milestoneAudioProbe.snapshot().stopped.length === 1,
    );
    let observation = await probe();
    assert.equal(observation.stopped[0].id, observation.started[0].id);
    assert.ok(
      observation.stopped[0].time - observation.started[0].time <
        observation.started[0].duration * 1000,
      "The live clip was stopped before its natural end",
    );
    if (action === "mute") {
      assert.equal(
        await page.evaluate(() => localStorage.getItem("champions.sound")),
        "off",
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await panel();
      assert.equal(
        await page
          .getByRole("checkbox", { name: "Enable sound", exact: true })
          .isChecked(),
        false,
      );
      assert.deepEqual(
        (await probe()).started,
        [],
        "Muted preference survives reload",
      );
    } else if (action === "screen-exit") {
      await page.getByRole("button", { name: /Resume mission/ }).click();
      await page.waitForTimeout(100);
      assert.equal(
        (await probe()).started.length,
        1,
        "Returning does not restart a stopped clip",
      );
    } else {
      await page.waitForTimeout(100);
      assert.equal(
        (await probe()).started.length,
        1,
        "Stopping does not replay a clip",
      );
    }
    conserved(await save(), original, action);
    checks.push({ ...current, observation });
  }

  // Headless Chromium never backgrounds tabs. Exercise the actual document
  // listener with an explicitly emulated visibility input; decoding/playback
  // stay native, and the report distinguishes this from a real tab switch.
  current = {
    scenario: "visibility-listener",
    width: 1280,
    visibilityInput: "emulated",
  };
  original = await open("upgrade", 1280);
  await enable();
  await panel(false);
  await trigger("upgrade");
  await started("upgrade");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () => window.__milestoneAudioProbe.snapshot().stopped.length === 1,
  );
  const hiddenObservation = await probe();
  assert.equal(hiddenObservation.visibility.at(-1).state, "hidden");
  assert.equal(
    hiddenObservation.stopped[0].id,
    hiddenObservation.started[0].id,
  );
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  assert.equal(
    (await probe()).started.length,
    1,
    "Visibility restoration does not replay",
  );
  conserved(await save(), original, "visibility listener");
  checks.push({ ...current, observation: hiddenObservation });

  await Promise.all(responseTasks);
  if (process.env.AUDIO_ENTRY_SHA256)
    assert.ok(
      entryProof.length &&
        entryProof.every(
          (entry) =>
            entry.sha256 === process.env.AUDIO_ENTRY_SHA256 &&
            entry.status === 200,
        ),
      "Actual production entry bytes match the frozen build",
    );
  for (const path of assets) {
    const responses = assetProofs.filter((entry) => entry.path === path);
    assert.ok(responses.length > 0, `${path}: fetched real audio`);
    assert.ok(
      responses.every((entry) => entry.status === 200 && entry.bytes > 100),
    );
    assert.equal(
      new Set(responses.map((entry) => entry.sha256)).size,
      1,
      "Immutable clip bytes",
    );
    const bytes = await readFile(`public${path}`);
    assert.equal(
      responses[0].sha256,
      createHash("sha256").update(bytes).digest("hex"),
      "Served clip matches the repository asset",
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        baseURL: url,
        ignoreHTTPSErrors,
        checks,
        audits,
        layouts,
        assetProofs,
        entryAssets: [...entries],
        entryProof,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      audits: audits.length,
      layouts: layouts.length,
      assets: assets.length,
      errors: 0,
      output,
    }),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      {
        baseURL: url,
        ignoreHTTPSErrors,
        current,
        error: error.stack || String(error),
        checks,
        audits,
        layouts,
        assetProofs,
        entryAssets: [...entries],
        entryProof,
        errors,
      },
      null,
      2,
    ),
  );
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await context?.close();
  await browser.close();
}
