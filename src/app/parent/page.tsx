"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ParentBottomNav,
  ParentFeed,
  ParentFeedError,
  ParentFeedLoading,
} from "../../components/parent-feed";
import { getVisitorId, store } from "../../lib/store";
import { loadParentFeedData, type ParentFeedData } from "./feed-model";

type ParentPageState =
  | { status: "loading" }
  | { status: "ready"; data: ParentFeedData }
  | { status: "error" };

export default function ParentPage() {
  const [state, setState] = useState<ParentPageState>({ status: "loading" });
  const requestIdRef = useRef(0);

  const loadFeed = useCallback(async (showLoading = true) => {
    const requestId = ++requestIdRef.current;
    if (showLoading) setState({ status: "loading" });

    try {
      const data = await loadParentFeedData(store, getVisitorId());
      if (requestId === requestIdRef.current) setState({ status: "ready", data });
    } catch {
      if (requestId === requestIdRef.current) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void loadFeed();
    const unsubscribe = store.subscribe(() => {
      void loadFeed(false);
    });
    return unsubscribe;
  }, [loadFeed]);

  return (
    <main className="min-h-dvh w-full bg-[#F7F4EC] text-[#383D37]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden">
        {state.status === "loading" ? <ParentFeedLoading /> : null}
        {state.status === "error" ? <ParentFeedError onRetry={() => void loadFeed()} /> : null}
        {state.status === "ready" ? (
          <ParentFeed
            entries={state.data.entries}
            familyName={state.data.family.name}
            kidName={state.data.family.kidName}
          />
        ) : null}
        <ParentBottomNav />
      </div>
    </main>
  );
}
