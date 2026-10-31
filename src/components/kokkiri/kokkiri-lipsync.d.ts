// kokkiri-lipsync.js(도하 09_lipsync, 빌드 없는 JS)의 타입. 쓰는 것만 적는다
import type { KokkiriPlayer } from "./kokkiri-player";

export class KokkiriLipSync {
  constructor(
    kk: KokkiriPlayer,
    opts?: {
      base?: string;
      talkClips?: string[];
      /** 지금 목소리 크기 0~1 */
      getLevel?: () => number;
      dataSet?: "auto" | "real" | "stub";
      maskDilate?: number;
      maskFeather?: number;
    },
  );
  /** 이 브라우저에서 입을 그릴 수 있는지 (안 되면 스스로 꺼져 원래 말하기 영상) */
  supported: boolean | null;
  /** 소리가 실제로 나기 시작할 때. 브라우저 목소리처럼 소리 크기를 모르면 { level: false } */
  start(opts?: { level?: boolean }): void;
  /** 소리가 끝났을 때 */
  end(): void;
  setEnabled(on: boolean): void;
  destroy(): void;
}
