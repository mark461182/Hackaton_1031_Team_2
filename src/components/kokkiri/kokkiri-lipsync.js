// 코끼리 립싱크 — kokkiri-player.js에 붙이는 덧대기 (빌드 없이 ES 모듈)
//
// 무엇을 하나
// - 영상 요소 바로 뒤(.kk-flip 안)에 같은 크기의 <canvas 960x960>을 얹는다. 플레이어의 이동·크기·좌우·톡·뛰기가 그대로 같이 걸린다
// - 영상이 프레임을 화면에 낼 때마다(requestVideoFrameCallback) 그 프레임과, 그 프레임 번호에 맞춘 입 조각을 한 캔버스에 같이 그린다
//   → 몸과 입이 한 그림이라 절대 어긋나지 않는다. 영상은 opacity 0으로만 숨긴다 (display·visibility로 숨기면 멈추고 빈 프레임이 난다)
// - 말하는 동안 코끼리는 입을 다문 구간(기본: 듣기·대기)을 1배속으로 틀고, 입은 소리 크기로 고른다 (0 없음 / 1 m1 / 2 m2 / 3 m3)
// - 캔버스에 투명도가 제대로 안 그려지는 브라우저(예: 사파리가 HEVC 투명 영상을 검게 그릴 때)나 rVFC가 없으면
//   캔버스를 빼고 아무것도 바꾸지 않는다 → 원래 플레이어(입이 움직이는 말하기 영상) 그대로
//
// 사용
//   import { KokkiriLipSync } from "./kokkiri-lipsync.js";
//   const lip = new KokkiriLipSync(kk, { base: "/kokkiri/lipsync/", getLevel: getSpeechLevel });
//   소리가 실제로 나기 시작할 때(첫 덩어리)  lip.start()                 // 클라우드·고정 대사 (소리 크기 있음)
//                                         lip.start({ level: false })  // 브라우저 목소리 (소리 크기 없음 → 원래 입 영상)
//   소리가 끝났을 때                        lip.end()
//   lip.setEnabled(false/true)  // 비교용 끄기·켜기
//   lip.destroy()
//   kk.speak(초)는 립싱크 중에 쓰지 않는다 (재생 속도를 0.8~2배로 바꿔 몸 움직임이 어색해진다)
//
// 데이터 (base 아래. 진짜가 없으면 stub/으로)
//   data/track.json        구간별 프레임마다 head·trunk 변환([a,b,c,d,e,f], 기준 자세 960 → 프레임), ok(0이면 그 프레임엔 입을 안 그림)
//   mouth/m1.png ~ m3.png  입 조각 (기준 자세 960x960 RGBA). m3이 없으면 2단계. 언제나 투명도 그대로(alpha 1) 그린다
//   data/trunk_mask.png    코 마스크 (회색조, 255 = 코). 입 조각을 코 자리에서 지운다 (조각은 일부러 코 뒤로 ~20px 이어져 있다)
//
// 앱에서는 이 파일을 kokkiri-player.js 옆에 두면 아래 import가 그대로 맞는다 (이 폴더에서는 ./kokkiri-player.js가 ../handoff/를 다시 내보낸다)
import { CLIPS, SEGMENTS } from "./kokkiri-player.js";

const FPS = 24;
const SIZE = 960; // 영상·기준 자세·캔버스 한 변
const LOG_MAX = 5000; // 프레임 기록 개수 (약 3분)
const HOLD = 2; // 한 입 모양을 최소 몇 프레임 유지하는가 (프레임마다 깜빡이지 않게)
const RELEASE = 2; // 더 작은 입이 몇 프레임 이어져야 닫는가
const MAX_FILL = 2; // ok=0이 이만큼(프레임) 이하로 짧게 끊기면 앞뒤 변환을 이어 채워 그린다
const NO_CAP = 255;
const IDENTITY = [1, 0, 0, 1, 0, 0];
// 말하는 동안 틀 입 다문 구간. 듣기 두 개만 모든 프레임이 깨끗하다.
// idle_2는 코가 말리는 곳(약 24~48, 60~72프레임)을 변환 하나로 못 따라가 입이 코 밑으로 비치고, idle_3은 추적 ok가 42%뿐이다.
// idle_1은 깨끗하지만 눈을 1.5초쯤 감는다 → 필요하면 talkClips로 넣는다
const DEFAULT_TALK = ["listening_1", "listening_2"];

// 소리 크기 문턱 (0~1, 단계 수별). 열 때는 open 이상, 그 단계를 놓는 건 close 아래로 내려갈 때 → 경계에서 떨지 않게
// 3단계: 활짝(m3)은 가끔 나오는 강조가 되게 높게 (타입캐스트 목소리 12문장 기준, 입 벌린 프레임 중 m3 약 27%)
const THRESHOLDS = {
  2: { open: [0.12, 0.35], close: [0.07, 0.25] },
  3: { open: [0.1, 0.35, 0.8], close: [0.06, 0.25, 0.65] },
};

const SETS = {
  real: { track: "data/track.json", mouth: "mouth/", mask: "data/trunk_mask.png" },
  stub: { track: "stub/track.json", mouth: "stub/", mask: "stub/trunk_mask.png" },
};

/** 변환이 말이 되는가 (크기 0.5~2배, 화면 안). 추적이 튄 프레임에 커다란 입이 그려지지 않게 */
const sane = (m) => {
  if (!Array.isArray(m) || m.length < 6 || !m.every(Number.isFinite)) return false;
  const det = m[0] * m[3] - m[1] * m[2];
  return det > 0.25 && det < 4 && Math.abs(m[4]) < SIZE && Math.abs(m[5]) < SIZE;
};
const lerp6 = (p, q, u) => p.map((v, k) => v + (q[k] - v) * u);

const canvas2d = (w = SIZE, h = SIZE, opts) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", opts)];
};
/** 픽셀을 읽느라 CPU에 둔 캔버스를 매 프레임 그리기 좋은 보통 캔버스로 옮긴다 */
const copyCanvas = (src) => {
  const [c, g] = canvas2d(src.width, src.height);
  g.drawImage(src, 0, 0);
  return c;
};

export class KokkiriLipSync {
  /**
   * @param kk KokkiriPlayer
   * @param opts.base 데이터 폴더 (data/, mouth/, stub/이 들어 있는 곳)
   * @param opts.talkClips 말하는 동안 틀 입 다문 구간들
   * @param opts.getLevel () => 지금 목소리 크기 0~1
   * @param opts.dataSet "auto"(진짜 먼저, 없으면 stub) | "real" | "stub"
   * @param opts.thresholds { open: [...], close: [...] } 단계 수만큼 (기본 THRESHOLDS)
   * @param opts.maskDilate 코 마스크를 몇 px 넓힐지 (0~1. 넓히면 입과 코 사이에 피부 틈이 보인다)
   * @param opts.maskFeather 코 마스크 가장자리 흐림 px
   */
  constructor(kk, { base = "./", talkClips = DEFAULT_TALK, getLevel = () => 0, dataSet = "auto", thresholds, maskDilate = 0, maskFeather = 1 } = {}) {
    this.kk = kk;
    this.video = kk.video;
    this.base = base.endsWith("/") ? base : base + "/";
    this.talk = talkClips.filter((n) => SEGMENTS[n]);
    this.original = [...CLIPS.speaking];
    this.baked = new Set(this.original.filter((n) => !this.talk.includes(n))); // 입이 움직이는 원래 말하기 구간 — 그 위엔 입을 안 그린다 (기준 자세인 0프레임만 빼고)
    this.getLevel = getLevel;
    this.dataSet = dataSet;
    this.userThresholds = thresholds;
    this.maskDilate = Math.min(1, Math.max(0, maskDilate | 0));
    this.maskFeather = Math.max(0, maskFeather | 0);

    this.supported = null; // null = 아직 모름 (첫 프레임을 그려 봐야 안다)
    this.reason = "";
    this.enabled = true; // 켜고 끄기 (비교용)
    this.active = false; // 지금 캔버스가 보이고 영상이 숨은 상태
    this.started = false; // 소리가 나는 중
    this.levelMode = true; // 이번 말에 소리 크기가 있는가
    this.assetsReady = false;
    this.clipsTouched = false;
    this.mouth = 0; // 소리로 정한 입 단계 (문턱·유지 규칙)
    this.held = HOLD;
    this.lowHist = [];
    this.vis = 0; // 실제로 그린 입 단계 (ok 끊김 앞뒤에서 한 단계씩 줄이고 늘린다)
    this.rising = false;
    this.probeTries = 0;
    this.levels = 0; // 입 모양 단계 수 (2 또는 3)
    this.sources = {};
    this.log = [];
    this.last = null;
    this.stats = { frames: 0, drawn: 0, insane: 0, filled: 0 };
    // 구간을 프레임 번호로 (구간 시작은 늘 정수 프레임)
    this.segList = Object.entries(SEGMENTS)
      .map(([name, s]) => ({ name, f0: Math.round(s.start * FPS), n: Math.round(s.sec * FPS) }))
      .sort((a, b) => a.f0 - b.f0);

    const [c, ctx] = canvas2d();
    c.className = "kk-lipsync";
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", pointerEvents: "none" });
    this.video.after(c);
    this.canvas = c;
    this.ctx = ctx;
    [this.off, this.offCtx] = canvas2d(16, 16); // 입 둘레만큼만 쓰는 작업 캔버스 (필요하면 커진다)
    this.videoOpacity = this.video.style.opacity;

    if (!("requestVideoFrameCallback" in HTMLVideoElement.prototype)) {
      this.disable("no-rvfc");
      this.loaded = Promise.resolve();
      return;
    }
    this.cb = (now, meta) => this.onFrame(now, meta);
    this.req = this.video.requestVideoFrameCallback(this.cb);
    this.loaded = this.load().catch((e) => this.disable(`assets: ${e.message}`));
  }

  // ---------- 데이터 ----------

  async load() {
    const order = this.dataSet === "auto" ? ["real", "stub"] : [this.dataSet];
    const get = async (path, parse) => {
      try {
        const res = await fetch(this.base + path, { cache: "no-cache" });
        return res.ok ? await parse(res) : null;
      } catch (e) {
        console.warn(`[lipsync] ${path}: ${e.message}`);
        return null;
      }
    };
    const first = async (key, parse) => {
      for (const set of order) {
        const value = await get(SETS[set][key], parse);
        if (value) return { value, set, path: SETS[set][key] };
      }
      return null;
    };
    const bitmap = async (res, raw) =>
      createImageBitmap(await res.blob(), raw ? { colorSpaceConversion: "none", premultiplyAlpha: "none" } : {});
    const json = async (res) => {
      const t = await res.json();
      if (!t || typeof t.segments !== "object") throw new Error("segments 없음");
      return t;
    };
    // 입은 한 곳(진짜 또는 stub)에서 m1부터 이어진 것까지 (m1·m2는 꼭, m3은 있으면)
    const mouths = async () => {
      for (const set of order) {
        const got = [];
        for (const k of [1, 2, 3]) {
          const path = `${SETS[set].mouth}m${k}.png`;
          const value = await get(path, (r) => bitmap(r));
          if (!value) break;
          got.push({ value, set, path });
        }
        if (got.length >= 2) return got;
      }
      return [];
    };
    const [track, mask, sprites] = await Promise.all([first("track", json), first("mask", (r) => bitmap(r, true)), mouths()]);
    if (!track || !mask || sprites.length < 2) throw new Error("track·mask·m1·m2 중 없는 것이 있음");
    const set = sprites[0].set;
    if (track.value.size && track.value.size !== SIZE) console.warn(`[lipsync] track.size ${track.value.size} ≠ ${SIZE}`);

    this.track = track.value;
    this.levels = sprites.length;
    this.prepTrack();
    const th = this.userThresholds ?? THRESHOLDS[this.levels];
    this.openTh = th.open.slice(0, this.levels);
    this.closeTh = th.close.slice(0, this.levels);
    this.sprites = [null, ...sprites.map((m) => this.prepSprite(m.value))];
    this.box = this.sprites.slice(1).reduce((u, s) => ({
      x0: Math.min(u.x0, s.box.x0), y0: Math.min(u.y0, s.box.y0), x1: Math.max(u.x1, s.box.x1), y1: Math.max(u.y1, s.box.y1),
    }), { x0: SIZE, y0: SIZE, x1: 0, y1: 0 });
    this.mask = this.prepMask(mask.value);
    this.sources = { track: track.path, mouth: sprites.map((m) => m.path).join(" "), mask: mask.path, levels: this.levels };
    const sets = new Set([track.set, mask.set, set]);
    this.sources.set = sets.size === 1 ? [...sets][0] : "mixed";
    this.assetsReady = true;
  }

  /**
   * 플레이어의 모든 구간에 대해 프레임별 변환·그려도 되는가(can)·끊김까지 남은 프레임(cap)을 미리 정한다.
   * 1. ok=1이고 변환이 말이 되는 프레임을 쓴다
   * 2. 모든 구간의 0프레임은 똑같은 기준 자세다 → 항등 변환, ok=1 (구간을 옮기는 사이 보이는 이음새 프레임에서도 입이 안 사라지게)
   * 3. 1~2프레임짜리 짧은 끊김은 앞뒤 ok 프레임의 변환을 선형으로 이어 채운다 (구간 끝의 끊김은 다음에 보일 기준 자세 = 항등으로 잇는다)
   * 4. 그래도 남은 끊김 사이에 혼자 있는 한 프레임은 그리지 않는다 (0프레임은 늘 그림)
   * 5. 원래 말하기 구간(입이 움직이는 영상)은 0프레임만
   * cap: 다음 끊김까지 남은 프레임 수 (끊김 바로 앞 1, 그 앞 2 …). 입은 이 값보다 크게 그리지 않는다 → 끊김 앞에서 한 단계씩 줄어든다
   *      0프레임은 다음에 어디가 보일지 모르니(이음새) 제한하지 않는다
   */
  prepTrack() {
    this.frames = {};
    this.stats.insane = 0;
    this.stats.filled = 0;
    for (const { name, n } of this.segList) {
      const t = this.track.segments[name];
      const head = new Array(n).fill(null);
      const trunk = new Array(n).fill(null);
      const okRaw = new Int8Array(n).fill(-1); // -1 = 데이터 없음
      const raw = new Uint8Array(n);
      if (t && Array.isArray(t.head) && Array.isArray(t.trunk)) {
        const m = Math.min(n, t.head.length, t.trunk.length);
        for (let k = 0; k < m; k++) {
          const ok = Array.isArray(t.ok) ? (t.ok[k] ? 1 : 0) : 1;
          const fine = sane(t.head[k]) && sane(t.trunk[k]);
          okRaw[k] = ok;
          if (ok && !fine) this.stats.insane++;
          if (ok && fine) {
            raw[k] = 1;
            head[k] = t.head[k];
            trunk[k] = t.trunk[k];
          }
        }
      }
      raw[0] = 1;
      head[0] = IDENTITY;
      trunk[0] = IDENTITY;
      for (let k = 1; k < n; ) {
        if (raw[k]) {
          k++;
          continue;
        }
        let e = k;
        while (e < n && !raw[e]) e++; // 끊김 [k, e). 앞 프레임 k-1은 늘 ok
        if (e - k <= MAX_FILL) {
          const L = k - 1;
          const rh = e < n ? head[e] : IDENTITY;
          const rt = e < n ? trunk[e] : IDENTITY;
          for (let j = k; j < e; j++) {
            const u = (j - L) / (e - L);
            // 추적기 값이 멀쩡하면 그대로 쓴다: 짧은 끊김은 기준을 아슬아슬하게 못 넘은 프레임이라
            // 직선 보간(검증 2.2~5.7px 어긋남)보다 원래 값(1.1~2.1px)이 정확하다
            const own = t && sane(t.head?.[j]) && sane(t.trunk?.[j]);
            head[j] = own ? t.head[j] : lerp6(head[L], rh, u);
            trunk[j] = own ? t.trunk[j] : lerp6(trunk[L], rt, u);
            raw[j] = 1;
            this.stats.filled++;
          }
        }
        k = e;
      }
      const can = raw.map((v, k) => (v && (k === 0 || raw[k - 1] || (k + 1 < n && raw[k + 1])) ? 1 : 0));
      if (this.baked.has(name)) can.fill(0, 1);
      const cap = new Uint8Array(n);
      let gap = Infinity;
      for (let k = n - 1; k >= 0; k--) {
        if (!can[k]) gap = k;
        else cap[k] = k === 0 ? NO_CAP : Math.min(NO_CAP, gap - k);
      }
      this.frames[name] = { head, trunk, okRaw, can, cap };
    }
  }

  /** 입 조각을 960 캔버스로 맞추고, 그림이 있는 범위(여백 2px)를 잰다 */
  prepSprite(img) {
    const [c, g] = canvas2d(SIZE, SIZE, { willReadFrequently: true });
    g.drawImage(img, 0, 0, SIZE, SIZE);
    const d = g.getImageData(0, 0, SIZE, SIZE).data;
    let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (d[(y * SIZE + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { img: copyCanvas(c), box: { x0: 0, y0: 0, x1: 1, y1: 1 } };
    return { img: copyCanvas(c), box: { x0: Math.max(0, x0 - 2), y0: Math.max(0, y0 - 2), x1: Math.min(SIZE, x1 + 3), y1: Math.min(SIZE, y1 + 3) } };
  }

  /** 회색조 코 마스크 → 알파 마스크 (넓히기 0~1px, 가장자리 흐림) */
  prepMask(img) {
    const [c, g] = canvas2d(SIZE, SIZE, { willReadFrequently: true });
    g.drawImage(img, 0, 0, SIZE, SIZE);
    const id = g.getImageData(0, 0, SIZE, SIZE);
    const d = id.data;
    let m = new Uint8ClampedArray(SIZE * SIZE);
    for (let p = 0; p < m.length; p++) m[p] = (d[p * 4] * d[p * 4 + 3]) / 255; // 회색 PNG도, 투명 배경 흰 PNG도 받게
    const pass = (src, r, op) => {
      // 가로·세로로 나눠 하는 최댓값(넓히기) 또는 평균(흐림)
      let a = src;
      for (const horiz of [true, false]) {
        const out = new Uint8ClampedArray(a.length);
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            let acc = 0;
            for (let k = -r; k <= r; k++) {
              const xx = horiz ? Math.min(SIZE - 1, Math.max(0, x + k)) : x;
              const yy = horiz ? y : Math.min(SIZE - 1, Math.max(0, y + k));
              const v = a[yy * SIZE + xx];
              acc = op === "max" ? Math.max(acc, v) : acc + v;
            }
            out[y * SIZE + x] = op === "max" ? acc : acc / (2 * r + 1);
          }
        }
        a = out;
      }
      return a;
    };
    if (this.maskDilate) m = pass(m, this.maskDilate, "max");
    if (this.maskFeather) m = pass(m, this.maskFeather, "mean");
    for (let p = 0; p < m.length; p++) {
      d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 0;
      d[p * 4 + 3] = m[p];
    }
    g.putImageData(id, 0, 0);
    return copyCanvas(c);
  }

  // ---------- 프레임마다 ----------

  /** 화면에 나온 프레임의 재생 위치 → (구간, 구간 안 프레임 번호) */
  frameAt(mediaTime) {
    const g = Math.round(mediaTime * FPS);
    for (const s of this.segList) if (g >= s.f0 && g < s.f0 + s.n) return { seg: s.name, i: g - s.f0 };
    const s = g < this.segList[0].f0 ? this.segList[0] : this.segList[this.segList.length - 1];
    return { seg: s.name, i: Math.min(s.n - 1, Math.max(0, g - s.f0)) };
  }

  /** 그 프레임의 변환·그려도 되는가(can)·끊김까지 남은 프레임(cap)·추적 원래 ok(okRaw, -1 = 데이터 없음) */
  frameData(seg, i) {
    const f = this.frames?.[seg];
    if (!f || i < 0 || i >= f.can.length) return null;
    return { head: f.head[i], trunk: f.trunk[i], can: f.can[i], cap: f.cap[i], okRaw: f.okRaw[i] };
  }

  onFrame(now, meta) {
    if (this.dead || this.supported === false) return;
    this.req = this.video.requestVideoFrameCallback(this.cb);
    const want = this.enabled && this.assetsReady && this.supported === true;
    const paint = this.supported === null || this.active || want;
    if (paint) {
      this.ctx.clearRect(0, 0, SIZE, SIZE);
      this.ctx.drawImage(this.video, 0, 0, SIZE, SIZE);
      if (this.supported === null && !this.probe()) return; // 아직 판단 못 함(다음 프레임에) 또는 지원 안 됨
    }
    const { seg, i } = this.frameAt(meta.mediaTime);
    const fd = this.frameData(seg, i);
    const kkState = this.kk.state;
    const level = this.getLevel();
    const allowed = this.active && this.started && this.levelMode && kkState === "speaking";
    const mouth = this.step(allowed, level);
    const can = fd ? fd.can : 0;
    const { vis, ramp } = this.visible(allowed, mouth, can, fd ? fd.cap : 0);
    const drawn = vis > 0 && this.drawPatch(this.sprites[vis], fd.head, fd.trunk);
    if (want !== this.active && paint) this.setActive(want); // 이 프레임을 캔버스에 다 그린 뒤에 바꾼다 → 빈 프레임 없음
    this.stats.frames++;
    if (drawn) this.stats.drawn++;
    const e = {
      mediaTime: meta.mediaTime,
      presentedFrames: meta.presentedFrames,
      expectedDisplayTime: meta.expectedDisplayTime,
      now,
      seg,
      i,
      kkState,
      level: Math.round(level * 1000) / 1000,
      mouth, // 소리로 정한 단계
      vis: drawn ? vis : 0, // 실제로 그린 단계 (m1~m3, 0 = 안 그림)
      ok: can, // 그려도 되는 프레임 (짧은 끊김 채움·0프레임 포함)
      okRaw: fd ? fd.okRaw : -1, // track.json의 ok 그대로
      drawn,
      ramp,
      started: this.started,
      levelMode: this.levelMode,
      active: this.active,
      rate: this.video.playbackRate,
    };
    this.last = e;
    this.log.push(e);
    if (this.log.length > LOG_MAX + 500) this.log.splice(0, this.log.length - LOG_MAX);
  }

  /**
   * 첫 프레임을 그린 뒤: 모서리는 투명해야 하고 몸통 가운데는 그림이 있어야 한다.
   * 본 캔버스와 같은 방식의 시험용 캔버스에 같은 프레임을 그려 읽는다 (본 캔버스를 읽으면 크롬이 그 캔버스를 느린 CPU 그리기로 바꿀 수 있다)
   */
  probe() {
    let corner = 0;
    let body = 0;
    const [pc, g] = canvas2d();
    try {
      g.drawImage(this.video, 0, 0, SIZE, SIZE);
      corner = Math.max(g.getImageData(4, 4, 1, 1).data[3], g.getImageData(SIZE - 5, 4, 1, 1).data[3]);
      const d = g.getImageData(380, 380, 200, 200).data;
      for (let k = 3; k < d.length; k += 4) if (d[k] > body) body = d[k];
    } catch {
      this.disable("canvas-tainted");
      return false;
    } finally {
      pc.width = pc.height = 0; // 메모리 돌려주기
    }
    if (body < 200) {
      if (++this.probeTries > 48) this.disable("no-frame"); // 2초 동안 그림이 안 나옴
      return false;
    }
    if (corner > 8) {
      this.disable("no-alpha"); // 투명 영상을 투명하게 못 그린다 (사파리 HEVC 등)
      return false;
    }
    this.supported = true;
    return true;
  }

  /** 소리 크기 → 입 단계. 열기는 바로(단, 지금 모양이 2프레임 이상 됐을 때), 닫기는 더 작은 단계가 2프레임 이어진 뒤 */
  step(allowed, level) {
    if (!allowed) {
      this.mouth = 0;
      this.held = HOLD;
      this.lowHist.length = 0;
      return 0;
    }
    const s = this.mouth;
    let up = 0;
    let keep = 0;
    for (let k = 1; k <= this.levels; k++) {
      if (level >= this.openTh[k - 1]) up = k;
      if (level >= this.closeTh[k - 1]) keep = k;
    }
    let next = s;
    if (up > s) {
      this.lowHist.length = 0;
      next = up;
    } else if (keep < s) {
      this.lowHist.push(keep);
      if (this.lowHist.length > RELEASE) this.lowHist.shift();
      if (this.lowHist.length >= RELEASE) next = Math.max(...this.lowHist);
    } else {
      this.lowHist.length = 0;
    }
    if (next !== s && this.held >= HOLD) {
      this.mouth = next;
      this.held = 1;
      this.lowHist.length = 0;
    } else {
      this.held++;
    }
    return this.mouth;
  }

  /**
   * 그릴 입 단계. ok가 끊기는 곳 앞에서는 한 프레임에 한 단계씩 줄이고(3→2→1→끊김), 끊김 뒤에는 0에서 한 단계씩 늘린다.
   * ramp: 이 프레임의 입이 그 규칙 때문에 소리로 정한 단계보다 작게 그려졌는가 (검사용)
   */
  visible(allowed, target, can, cap) {
    if (!allowed) {
      this.vis = 0;
      this.rising = false;
      return { vis: 0, ramp: false };
    }
    if (!can) {
      this.vis = 0;
      this.rising = true; // 끊김 다음엔 0부터 한 단계씩
      return { vis: 0, ramp: false };
    }
    let v = Math.min(target, cap);
    if (this.rising) {
      v = Math.min(v, this.vis + 1);
      if (v >= target) this.rising = false;
    }
    this.vis = v;
    return { vis: v, ramp: v < target };
  }

  /** 입 조각: 작업 캔버스에 head 변환으로 입 → trunk 변환으로 코 마스크를 지움 → 본 캔버스에 (늘 alpha 1) */
  drawPatch(sprite, head, trunk) {
    const [a, b, c, d, e, f] = head;
    const { x0, y0, x1, y1 } = this.box;
    const xs = [a * x0 + c * y0 + e, a * x1 + c * y0 + e, a * x0 + c * y1 + e, a * x1 + c * y1 + e];
    const ys = [b * x0 + d * y0 + f, b * x1 + d * y0 + f, b * x0 + d * y1 + f, b * x1 + d * y1 + f];
    const bx = Math.max(0, Math.floor(Math.min(...xs)) - 2);
    const by = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const bw = Math.min(SIZE, Math.ceil(Math.max(...xs)) + 2) - bx;
    const bh = Math.min(SIZE, Math.ceil(Math.max(...ys)) + 2) - by;
    if (bw <= 0 || bh <= 0) return false;
    const off = this.off;
    let o = this.offCtx;
    if (off.width < bw || off.height < bh) {
      off.width = Math.max(off.width, bw);
      off.height = Math.max(off.height, bh);
      o = this.offCtx = off.getContext("2d");
    }
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "source-over";
    o.clearRect(0, 0, bw, bh);
    o.setTransform(a, b, c, d, e - bx, f - by);
    o.drawImage(sprite.img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    o.globalCompositeOperation = "destination-out";
    o.setTransform(trunk[0], trunk[1], trunk[2], trunk[3], trunk[4] - bx, trunk[5] - by);
    o.drawImage(this.mask, 0, 0);
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "source-over";
    this.ctx.drawImage(off, 0, 0, bw, bh, bx, by, bw, bh);
    return true;
  }

  // ---------- 켜고 끄기 ----------

  setActive(on) {
    this.active = on;
    this.canvas.style.opacity = on ? "1" : "0";
    this.video.style.opacity = on ? "0" : this.videoOpacity;
    this.applyClips();
  }

  /** 립싱크 중이면 말하기 = 입 다문 구간들, 아니면(꺼짐·소리 크기 없는 말) 원래 말하기 구간 */
  applyClips() {
    if (this.supported !== true || this.dead) return;
    const talk = this.active && !(this.started && !this.levelMode);
    CLIPS.speaking = [...(talk ? this.talk : this.original)];
    this.clipsTouched = true;
  }

  /** 비교용 켜기·끄기. 끌 때는 바로 영상을 보이고, 켤 때는 다음 프레임을 캔버스에 그린 뒤 바꾼다 */
  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled && this.active) this.setActive(false);
  }

  // ---------- 말하기 ----------

  /** 목소리가 실제로 나기 시작할 때 (말 하나에 한 번. 이미 말하는 중이면 다시 튀지 않는다) */
  start({ level = true } = {}) {
    this.levelMode = !!level;
    const already = this.started && this.kk.state === "speaking";
    this.started = true;
    this.applyClips();
    if (!already) this.kk.speakStart();
  }

  /** 목소리가 끝났을 때 */
  end() {
    this.started = false;
    this.mouth = 0;
    this.lowHist.length = 0;
    this.kk.speakEnd();
    this.levelMode = true;
    this.applyClips();
  }

  /** 지금 캔버스 그림 (검증용 PNG data URL). 같은 순간의 프레임 정보는 lip.last */
  snapshot() {
    return this.canvas?.isConnected ? this.canvas.toDataURL() : null;
  }

  disable(reason) {
    this.supported = false;
    this.reason = reason;
    if (this.req !== undefined) this.video.cancelVideoFrameCallback?.(this.req);
    this.canvas?.remove();
    this.video.style.opacity = this.videoOpacity;
    this.active = false;
    if (this.clipsTouched) CLIPS.speaking = [...this.original];
    console.info(`[lipsync] 끔: ${reason}`);
  }

  destroy() {
    this.dead = true;
    if (this.req !== undefined) this.video.cancelVideoFrameCallback?.(this.req);
    this.canvas?.remove();
    this.video.style.opacity = this.videoOpacity;
    if (this.clipsTouched) CLIPS.speaking = [...this.original];
  }
}
