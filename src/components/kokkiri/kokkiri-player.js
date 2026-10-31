// 코끼리 플레이어 — 상태 영상 12개를 이은 한 파일(kokkiri.webm / kokkiri.mov)을 영상 요소 하나로 튼다.
//
// 왜 한 파일·한 요소인가 (11/1 프레임 단위 측정으로 확인한 끊김의 원인)
// - 영상 요소 두 개를 숨겼다 보였다 하면, 숨겨 둔 요소는 브라우저가 그리기를 쉬다가 보이는 순간 다시 준비해 수백 ms 멈추고,
//   상태를 빠르게 두 번 바꾸면 앞뒤가 꼬여 보이는 요소의 영상을 갈아 끼워 코끼리가 한 프레임 사라졌다
// - 영상이 끝난 뒤에야 다음 파일을 불러와 이음새마다 83~367ms 멈췄다
// → 요소 하나만 늘 보이게 두고, 파일 안에서 구간만 옮긴다. 옮기는 동안 브라우저는 직전 그림을 계속 보여 준다 (빈 화면 없음)
//
// 규칙
// 1. 모든 구간은 같은 "기준 자세" 프레임에서 시작하고, 끝은 그 자세로 서서히 돌아온다 (tools/build_atlas.py)
// 2. 다음 구간이 파일에서 바로 이어지면 건너뛰지 않고 흘려 보낸다
// 3. 다른 구간으로 갈 땐, 구간 끝 다음에 이미 나오는 기준 자세 프레임이 보이는 동안 목적지의 두 번째 프레임으로 건너뛴다
//    → 건너뛰는 시간이 같은 자세 위에 숨는다
// 4. 버튼을 누를 때처럼 바로 바꿔야 하면 그 자리에서 목적지 첫 프레임으로 건너뛰고 "톡" 튀어 이음새를 가린다
// 5. 말하기는 소리 길이에 맞춰 재생 속도(0.8~2배)를 고른다. 소리가 먼저 끝나면 짧게 남았을 땐 빨리 감고, 길면 톡 튀며 대기로
//
// 사용
//   const kk = new KokkiriPlayer(무대요소, { base: "/kokkiri/", bg: "peach" });
//   await kk.load();
//   kk.unlock()                // 첫 버튼 onClick 안에서 한 번 (아이폰 저전력 모드에서도 재생되게)
//   kk.setBackground("golden") // 배경: "peach"(살구빛 아침) | "golden"(노란 오후)
//   kk.setState("listening")   // 꾹 누르는 순간
//   kk.setState("thinking")    // 손을 뗀 순간
//   kk.speak(소리길이초)         // 소리가 실제로 시작되는 순간 (길이를 알 때)
//   kk.speakStart() / kk.speakEnd()  // 길이를 모를 때 (브라우저 목소리 등)
//   kk.destroy()

// 파일 안 구간 (초). tools/build_atlas.py가 만든 07_atlas/segments.json과 같아야 한다
export const SEGMENTS = {
  idle_1: { start: 0, sec: 4 },
  idle_2: { start: 4, sec: 4 },
  idle_3: { start: 8, sec: 4 },
  listening_1: { start: 12, sec: 4 },
  listening_2: { start: 16, sec: 4 },
  thinking_1: { start: 20, sec: 4 },
  thinking_2: { start: 24, sec: 4 },
  thinking_3: { start: 28, sec: 4 },
  thinking_4: { start: 32, sec: 4 },
  speaking_1: { start: 36, sec: 4 },
  speaking_2: { start: 40, sec: 5 },
  speaking_3: { start: 45, sec: 6 },
};

export const CLIPS = {
  idle: ["idle_1", "idle_2", "idle_3"],
  listening: ["listening_1", "listening_2"],
  thinking: ["thinking_1", "thinking_2", "thinking_3", "thinking_4"],
  speaking: ["speaking_1", "speaking_2", "speaking_3"],
};

// 고를 수 있는 배경 (풀밭 언덕 두 가지)
export const BACKGROUNDS = {
  peach: { file: "bg_hill_peach.png", label: "살구빛 아침" },
  golden: { file: "bg_hill_golden.png", label: "노란 오후" },
};

// 상태별 서 있을 자리 (무대 가로 %, 크기 배율)
const SPOTS = {
  idle: [{ x: 50, s: 1 }, { x: 30, s: 0.94 }, { x: 70, s: 0.94 }],
  listening: [{ x: 50, s: 1.12 }],
  thinking: [{ x: 32, s: 0.97 }, { x: 68, s: 0.97 }],
  speaking: [{ x: 50, s: 1.05 }],
};

const FRAME = 1 / 24;
const EPS = 0.001; // 구간 시작 시각에 딱 맞추면 소수 오차로 앞 프레임에 떨어질 수 있어 살짝 안쪽을 가리킨다
const MIN_RATE = 0.8;
const MAX_RATE = 2.0;
const FINISH_RATE = 3; // 소리가 먼저 끝났을 때 남은 부분을 마저 감는 속도

/** 아이폰·아이패드(모든 브라우저)와 맥 사파리는 HEVC 투명 영상(.mov), 나머지는 VP9 투명 영상(.webm) */
function videoExt() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  return ios || safari ? "mov" : "webm";
}

/** 목록에서 하나를 고른다. avoid는 되도록 피한다 */
const pick = (list, avoid) => {
  const rest = avoid ? list.filter((c) => c !== avoid) : list;
  const pool = rest.length ? rest : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

export class KokkiriPlayer {
  constructor(stage, { base = "/kokkiri/", bg = "peach", onClip } = {}) {
    this.stage = stage;
    this.base = base.endsWith("/") ? base : base + "/";
    this.onClip = onClip; // 디버그용: (상태, 구간 이름) 알림
    this.state = "idle";
    this.current = null; // 지금 구간 { name, start, end }
    this.plan = []; // 말하기에서 이어 틀 구간과 속도
    this.open = false; // 길이를 모르는 말하기 중
    this.seeking = false;
    this.ready = false;
    this.spot = SPOTS.idle[0];
    this.flipped = false;
    this.idleCount = 0;
    this.dead = false;
    this.build();
    this.setBackground(bg);
  }

  build() {
    // 배경 두 겹: 바꿀 때 새 배경이 서서히 덮는다 (코끼리 뒤에 깔림)
    const bgs = document.createElement("div");
    bgs.className = "kk-bgs";
    bgs.innerHTML = `<div class="kk-bg"></div><div class="kk-bg"></div>`;
    this.stage.prepend(bgs);
    this.bgs = bgs;
    this.bgLayers = [...bgs.children];
    this.bgFront = 0;

    const el = document.createElement("div");
    el.className = "kk";
    el.innerHTML = `<div class="kk-actor"><div class="kk-shadow"></div><div class="kk-body"><div class="kk-flip"><video muted playsinline preload="auto"></video></div></div></div>`;
    this.stage.appendChild(el);
    this.el = el;
    this.flipEl = el.querySelector(".kk-flip");
    this.video = el.querySelector("video");
    this.video.poster = `${this.base}idle.png`; // 영상이 오기 전에도 빈칸 없게
    this.vids = [this.video]; // 측정 도구와 이름을 맞춤
    this.front = 0;
    this.video.addEventListener("seeked", () => (this.seeking = false));
    this.video.addEventListener("ended", () => this.advance(false)); // 파일 끝(마지막 구간) 다음
    this.moveTo(this.spot, false);
  }

  /** 파일을 통째로 받아 둔다 (구간 이동이 네트워크를 기다리지 않게). 끝나면 대기부터 튼다 */
  async load() {
    const res = await fetch(`${this.base}kokkiri.${videoExt()}`);
    this.url = URL.createObjectURL(await res.blob());
    if (this.dead) return;
    const v = this.video;
    v.src = this.url;
    await new Promise((r) => v.addEventListener("loadeddata", r, { once: true }));
    this.ready = true;
    this.watch();
    this.jump(pick(CLIPS[this.state]), { skipAnchor: false }); // 불러오는 사이 상태가 바뀌었으면 그 상태로 시작
  }

  /** 첫 버튼 onClick 안에서 부른다. 아이폰 저전력 모드처럼 자동 재생이 막혀도 이후로는 재생된다 */
  unlock() {
    if (this.ready && this.video.paused) this.video.play().catch(() => {});
  }

  /** 화면에 프레임이 나올 때마다 지금 구간이 끝났는지 본다 */
  watch() {
    const v = this.video;
    if ("requestVideoFrameCallback" in v) {
      const tick = (_now, meta) => {
        if (this.dead) return;
        this.onFrame(meta.mediaTime);
        this.frameReq = v.requestVideoFrameCallback(tick);
      };
      this.frameReq = v.requestVideoFrameCallback(tick);
    } else {
      // 오래된 브라우저: 화면 갱신마다 재생 위치를 본다
      const loop = () => {
        if (this.dead) return;
        this.onFrame(v.currentTime);
        this.rafReq = requestAnimationFrame(loop);
      };
      this.rafReq = requestAnimationFrame(loop);
    }
  }

  onFrame(t) {
    if (this.seeking || !this.current) return;
    const { start, end } = this.current;
    if (t >= end - EPS) {
      // 구간 다음 프레임(= 다음 구간의 기준 자세)이 나왔다 → 그 자세가 보이는 동안 다음으로
      this.advance(t < end + FRAME - EPS);
    } else if (t < start - EPS) {
      this.advance(false); // 탭을 내렸다 올린 뒤처럼 구간을 벗어났다 → 다시 맞춘다
    }
  }

  /** 지금 구간이 끝났을 때: 같은 상태의 다른 구간, 또는 말하기 계획의 다음 구간 */
  advance(skipAnchor) {
    if (this.state === "speaking") {
      const step = this.plan.shift();
      if (step) return this.jump(step.name, { rate: step.rate, skipAnchor });
      if (this.open) return this.jump(pick(CLIPS.speaking, this.current?.name), { skipAnchor });
      return this.toIdle(false, skipAnchor); // 소리가 끝났고 계획도 끝 → 자연스럽게 대기로
    }
    if (this.state === "idle" && ++this.idleCount % 2 === 0 && Math.random() < 0.6) this.wander();
    this.jump(pick(CLIPS[this.state], this.current?.name), { skipAnchor });
  }

  /**
   * 구간으로 간다.
   * skipAnchor: 이미 기준 자세 프레임이 화면에 있으니 목적지의 두 번째 프레임으로 간다
   * pop: 바로 바꾸는 경우 — 목적지 첫 프레임으로 가고 톡 튄다
   */
  jump(name, { rate = 1, skipAnchor = false, pop = false } = {}) {
    if (!this.ready) return;
    const seg = SEGMENTS[name];
    const v = this.video;
    const prevEnd = this.current?.end;
    this.current = { name, start: seg.start, end: seg.start + seg.sec };
    v.playbackRate = rate;
    this.onClip?.(this.state, name);
    const contiguous = !pop && prevEnd !== undefined && Math.abs(prevEnd - seg.start) < EPS && !v.ended;
    if (!contiguous) {
      this.seeking = true;
      v.currentTime = seg.start + (skipAnchor && !pop ? FRAME : 0) + EPS;
    }
    if (pop) this.bump("kk-pop");
    if (v.paused) v.play().catch(() => {}); // 자동 재생이 막히면 첫 장면 그림이 그대로 보인다 → unlock()
  }

  /** 상태 바꾸기. 대기·듣기·생각은 바로 바꾸고 톡 튀어 이음새를 가린다 */
  setState(state) {
    if (state === this.state || !CLIPS[state]) return;
    clearTimeout(this.speakTimer);
    this.state = state;
    this.plan = [];
    this.open = false;
    this.moveTo(pick(SPOTS[state]));
    this.jump(pick(CLIPS[state], this.current?.name), { pop: true });
  }

  /** 소리 길이(초)를 알 때: 그 길이에 맞게 말하기 구간을 고르고 속도를 맞춘다 */
  speak(seconds) {
    clearTimeout(this.speakTimer);
    this.state = "speaking";
    this.open = false;
    this.moveTo(SPOTS.speaking[0]);
    this.plan = this.fit(seconds);
    const first = this.plan.shift();
    this.jump(first.name, { rate: first.rate, pop: true });
    // 소리가 끝났는데 영상이 아직 남았으면 마무리
    this.speakTimer = setTimeout(() => this.finishSpeaking(), seconds * 1000);
  }

  /** 길이를 모르는 말하기 시작/끝 */
  speakStart() {
    clearTimeout(this.speakTimer);
    this.state = "speaking";
    this.plan = [];
    this.open = true;
    this.moveTo(SPOTS.speaking[0]);
    this.jump(pick(CLIPS.speaking, this.current?.name), { pop: true });
  }

  speakEnd() {
    this.open = false;
    this.plan = [];
    this.finishSpeaking();
  }

  finishSpeaking() {
    if (this.state !== "speaking" || !this.current) return;
    this.plan = [];
    const v = this.video;
    const left = this.current.end - v.currentTime;
    if (left <= 0.25) return; // 곧 기준 자세로 끝난다 → advance()가 대기로 잇는다
    // 0.5초 안에 감을 수 있으면 빨리 감아 기준 자세로, 아니면 톡 튀며 바로 대기로 (소리 없이 입만 오래 움직이지 않게)
    if (left / FINISH_RATE <= 0.5) v.playbackRate = Math.max(v.playbackRate, FINISH_RATE);
    else this.toIdle(true);
  }

  /** 말하기 계획: 한 구간으로 맞으면 그것, 길면 여러 개를 이어 붙인다 */
  fit(seconds) {
    const list = CLIPS.speaking;
    const sec = (n) => SEGMENTS[n].sec;
    const clamp = (r) => Math.min(MAX_RATE, Math.max(MIN_RATE, r));
    // 1) 구간 하나로 속도 0.8~1.25배 안에 맞는 것 중 1배에 가장 가까운 것
    const single = list
      .map((name) => ({ name, rate: sec(name) / seconds }))
      .filter((p) => p.rate >= MIN_RATE && p.rate <= 1.25 && p.name !== this.current?.name)
      .sort((a, b) => Math.abs(1 - a.rate) - Math.abs(1 - b.rate))[0];
    if (single) return [single];
    // 2) 짧은 말: 가장 짧은 구간을 빠르게 (최대 2배, 나머지는 끝날 때 빨리 감기)
    const shortest = [...list].sort((a, b) => sec(a) - sec(b))[0];
    if (seconds < sec(shortest)) return [{ name: shortest, rate: clamp(sec(shortest) / seconds) }];
    // 3) 긴 말: 같은 구간이 연달아 오지 않게 이어 붙이고, 전체 속도를 맞춘다
    const chain = [];
    let total = 0;
    let last = this.current?.name;
    while (total < seconds * 0.9) {
      const n = pick(list, last);
      chain.push(n);
      total += sec(n);
      last = n;
    }
    const rate = clamp(total / seconds);
    return chain.map((name) => ({ name, rate }));
  }

  toIdle(pop = false, skipAnchor = false) {
    this.state = "idle";
    this.moveTo(SPOTS.idle[0]);
    this.jump(pick(CLIPS.idle, this.current?.name), { pop, skipAnchor });
  }

  /** 대기 중에 다른 자리로 톡톡 뛰어 이동 */
  wander() {
    const spots = SPOTS.idle.filter((s) => s !== this.spot);
    this.moveTo(spots[Math.floor(Math.random() * spots.length)]);
  }

  moveTo(spot, animate = true) {
    if (!spot) return;
    const moved = spot.x !== this.spot.x;
    this.spot = spot;
    this.el.style.setProperty("--kk-x", `${spot.x}%`);
    this.el.style.setProperty("--kk-s", spot.s);
    if (animate && moved) {
      this.bump("kk-hop");
      // 공중에 떠 있는 순간에 좌우를 바꾼다 (땅에서 바꾸면 꼬리가 툭 넘어가 보임)
      if (Math.random() < 0.5) {
        clearTimeout(this.flipTimer);
        this.flipTimer = setTimeout(() => {
          this.flipped = !this.flipped;
          this.flipEl.style.setProperty("--kk-flip", this.flipped ? -1 : 1);
        }, 340);
      }
    }
  }

  /** 배경 바꾸기: "peach"(살구빛 아침) | "golden"(노란 오후) */
  setBackground(name) {
    const bg = BACKGROUNDS[name];
    if (!bg || name === this.bg) return;
    this.bg = name;
    const next = this.bgLayers[1 - this.bgFront];
    next.style.backgroundImage = `url(${this.base}${bg.file})`;
    next.classList.add("on");
    this.bgLayers[this.bgFront].classList.remove("on");
    this.bgFront = 1 - this.bgFront;
  }

  bump(cls) {
    this.el.classList.remove("kk-pop", "kk-hop");
    void this.el.offsetWidth; // 같은 애니메이션을 다시 시작
    this.el.classList.add(cls);
  }

  destroy() {
    this.dead = true;
    clearTimeout(this.speakTimer);
    clearTimeout(this.flipTimer);
    if (this.frameReq !== undefined) this.video.cancelVideoFrameCallback?.(this.frameReq);
    if (this.rafReq !== undefined) cancelAnimationFrame(this.rafReq);
    this.video.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.el.remove();
    this.bgs.remove();
  }
}
