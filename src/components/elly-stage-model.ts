export function getEllyImagePresentation(motionFailed: boolean) {
  return motionFailed
    ? { showMotion: false, showStill: true, stillClassName: "block" as const }
    : { showMotion: true, showStill: true, stillClassName: "elly-still" as const };
}
