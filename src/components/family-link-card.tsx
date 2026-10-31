"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  clearFamilyLink,
  familyLinkAvailable,
  isDemoContext,
  kidLinkUrl,
  parentLinkUrl,
  readFamilyLink,
  saveFamilyLink,
  type FamilyLink,
  type FamilyStateResponse,
} from "@/lib/family-link";

type CreateResponse = { familyId: string; parentKey: string; kidKey: string; storage: "supabase" | "memory" } & Pick<
  FamilyStateResponse,
  "state"
>;

/** 부모 홈: 아이 링크 만들기·보내기·바꾸기. 그 링크로 들어온 아이 폰만 이 가족 기록을 같이 쓴다 */
export function FamilyLinkCard({ kidName }: { kidName: string }) {
  const [ready, setReady] = useState(false);
  const [link, setLink] = useState<FamilyLink | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);

  useEffect(() => {
    if (isDemoContext()) return;
    setLink(readFamilyLink());
    setOrigin(window.location.origin);
    void familyLinkAvailable().then(setReady);
  }, []);

  if (!ready) return null;

  // 아이 링크를 연 폰(브라우저)에서 부모 화면을 열면 카드가 사라져서 고장처럼 보였다 → 이유와 되돌리는 방법을 알려 준다
  if (link?.role === "kid") {
    return (
      <Card tone="sage" className="mt-5 p-5" data-ui="P-link-kid-device">
        <h2 className="font-friendly text-[17px] text-sage-title">이 폰은 아이용으로 연결돼 있어요</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-sage-body">
          이 브라우저에서 아이 링크를 열어서, 아이 링크 만들기가 보이지 않아요. 부모 링크가 있으면 그 주소로 다시 열어 주세요.
          없으면 아래 버튼으로 이 폰의 아이 연결을 끊고 부모로 다시 시작할 수 있어요.
        </p>
        <Button
          size="sm"
          className="mt-4 w-full px-4 text-[15px] hover:bg-sage-deep-hover"
          onClick={() => {
            clearFamilyLink();
            window.location.reload();
          }}
          data-ui="P-link-reconnect-parent"
        >
          부모로 다시 연결하기
        </Button>
        <p className="mt-3 text-[12px] leading-5 text-ink-sage-body">
          아이 연결을 끊어도 아이 폰과 가족 기록은 그대로예요. 아이를 테스트할 때는 시크릿 창으로 열면 안 꼬여요.
        </p>
      </Card>
    );
  }

  async function create() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidName }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as CreateResponse;
      saveFamilyLink({ role: "parent", key: body.parentKey, familyId: body.familyId, kidKey: body.kidKey }, body.state);
      window.location.reload();
    } catch {
      setNote("링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  async function rotate() {
    if (!link) return;
    setBusy(true);
    try {
      const res = await fetch("/api/family/rotate", { method: "POST", headers: { "x-family-key": link.key } });
      if (!res.ok) throw new Error();
      const { kidKey } = (await res.json()) as { kidKey: string };
      const next = { ...link, kidKey };
      window.localStorage.setItem("elly:link:v1", JSON.stringify(next));
      setLink(next);
      setConfirmRotate(false);
      setNote("새 아이 링크를 만들었어요. 아이 폰에서 새 링크를 다시 열어 주세요. 예전 링크는 이제 열리지 않아요.");
    } catch {
      setNote("링크를 바꾸지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string, done: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNote(done);
    } catch {
      setNote(`복사가 막혔어요. 이 주소를 직접 보내 주세요: ${url}`);
    }
  }

  async function share(url: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Elly", text: `${kidName}에게 보내는 Elly 링크`, url });
        return;
      } catch {
        // 공유 창을 닫았으면 복사로
      }
    }
    await copy(url, "아이 링크를 복사했어요. 아이 폰으로 보내 주세요.");
  }

  if (!link) {
    return (
      <Card tone="sage" className="mt-5 p-5" data-ui="P-link">
        <h2 className="font-friendly text-[17px] text-sage-title">아이 폰과 연결하기</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-sage-body">
          아이 링크를 만들어 {kidName}의 폰으로 보내 주세요. 그 링크로 들어온 폰만 우리 가족 기록을 함께 써요.
        </p>
        <Button
          size="sm"
          className="mt-4 w-full px-4 text-[15px] hover:bg-sage-deep-hover disabled:opacity-60"
          onClick={() => void create()}
          disabled={busy}
          data-ui="P-link-create"
        >
          아이 링크 만들기
        </Button>
        {note ? <p className="mt-3 text-[13px] text-danger-ink">{note}</p> : null}
      </Card>
    );
  }

  const kidUrl = link.kidKey ? kidLinkUrl(origin, link.kidKey) : "";
  return (
    <Card tone="sage" className="mt-5 p-5" data-ui="P-link">
      <h2 className="font-friendly text-[17px] text-sage-title">{kidName}의 Elly 링크</h2>
      <p className="mt-2 text-[14px] leading-6 text-ink-sage-body">이 링크를 아이 폰에서 한 번 열면 다음부터는 그냥 열려요.</p>
      {kidUrl ? (
        <>
          <p className="mt-3 truncate rounded-2xl bg-surface px-4 py-3 font-mono text-[12px] text-ink-muted">{kidUrl}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="xs" className="px-3 text-[14px]" onClick={() => void share(kidUrl)} disabled={busy} data-ui="P-link-share">
              아이에게 보내기
            </Button>
            <Button
              variant="surface"
              size="xs"
              className="px-3 text-[14px]"
              onClick={() => void copy(kidUrl, "아이 링크를 복사했어요.")}
              disabled={busy}
              data-ui="P-link-copy"
            >
              링크 복사
            </Button>
          </div>
        </>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Button variant="text" className="text-[13px]" onClick={() => setConfirmRotate(true)} disabled={busy} data-ui="P-link-rotate">
          링크 바꾸기
        </Button>
        <Button
          variant="text"
          className="text-[13px]"
          onClick={() => void copy(parentLinkUrl(origin, link.key), "부모 링크를 복사했어요. 다른 폰에서 부모 화면을 열 때 써요.")}
          data-ui="P-link-parent"
        >
          부모 링크 복사
        </Button>
        <Button
          variant="text"
          className="text-[13px]"
          onClick={() => {
            clearFamilyLink();
            window.location.reload();
          }}
          data-ui="P-link-clear"
        >
          이 폰에서 연결 끊기
        </Button>
      </div>
      {confirmRotate ? (
        <div className="mt-3 rounded-2xl bg-surface p-4" role="alertdialog" aria-label="아이 링크 바꾸기">
          <p className="text-[14px] leading-6 text-ink">
            링크를 바꾸면 지금 아이 폰은 바로 연결이 끊겨요. 새 링크를 아이 폰에서 다시 열어야 해요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="xs" className="px-3 text-[14px]" onClick={() => void rotate()} disabled={busy} data-ui="P-link-rotate-ok">
              바꾸기
            </Button>
            <Button variant="surface" size="xs" className="border border-line-input px-3 text-[14px]" onClick={() => setConfirmRotate(false)} data-ui="P-link-rotate-cancel">
              그만두기
            </Button>
          </div>
        </div>
      ) : null}
      {note ? <p className="mt-3 text-[13px] leading-5 text-ink-sage-body [overflow-wrap:anywhere]" role="status">{note}</p> : null}
    </Card>
  );
}
