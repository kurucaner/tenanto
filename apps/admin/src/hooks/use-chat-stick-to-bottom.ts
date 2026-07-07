import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 80;

function getIsNearBottom(container: HTMLDivElement): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    NEAR_BOTTOM_THRESHOLD_PX
  );
}

export interface UseChatStickToBottomOptions {
  enabled?: boolean;
  forceScrollMessageId?: string | null;
  lastMessageId: string | null;
}

export interface UseChatStickToBottomResult {
  clearPendingBelow: () => void;
  handleScroll: () => void;
  isNearBottom: boolean;
  pendingBelowCount: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useChatStickToBottom({
  enabled = true,
  forceScrollMessageId,
  lastMessageId,
}: UseChatStickToBottomOptions): UseChatStickToBottomResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastHandledMessageIdRef = useRef<string | null>(null);
  const lastForceScrollMessageIdRef = useRef<string | null>(null);
  const hasInitialScrolledRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [pendingBelowCount, setPendingBelowCount] = useState(0);

  const applyScrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({ behavior, top: container.scrollHeight });
    isNearBottomRef.current = true;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "instant") => {
      applyScrollToBottom(behavior);
      setIsNearBottom(true);
      setPendingBelowCount(0);
    },
    [applyScrollToBottom]
  );

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const near = getIsNearBottom(container);
    isNearBottomRef.current = near;
    setIsNearBottom(near);

    if (near) {
      setPendingBelowCount(0);
    }
  }, []);

  const clearPendingBelow = useCallback(() => {
    setPendingBelowCount(0);
  }, []);

  useLayoutEffect(() => {
    if (!enabled || lastMessageId == null || hasInitialScrolledRef.current) return;

    hasInitialScrolledRef.current = true;
    lastHandledMessageIdRef.current = lastMessageId;
    applyScrollToBottom("instant");
  }, [enabled, lastMessageId, applyScrollToBottom]);

  useLayoutEffect(() => {
    if (!enabled || lastMessageId == null) return;
    if (lastMessageId === lastHandledMessageIdRef.current) return;

    const isUserSentScroll =
      forceScrollMessageId != null &&
      forceScrollMessageId === lastMessageId &&
      forceScrollMessageId !== lastForceScrollMessageIdRef.current;

    if (isUserSentScroll) {
      lastForceScrollMessageIdRef.current = forceScrollMessageId;
      lastHandledMessageIdRef.current = lastMessageId;

      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
      return;
    }

    if (isNearBottomRef.current) {
      lastHandledMessageIdRef.current = lastMessageId;

      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
      return;
    }

    lastHandledMessageIdRef.current = lastMessageId;
    requestAnimationFrame(() => {
      setPendingBelowCount((count) => count + 1);
    });
  }, [enabled, forceScrollMessageId, lastMessageId, scrollToBottom]);

  return {
    clearPendingBelow,
    handleScroll,
    isNearBottom,
    pendingBelowCount,
    scrollRef,
    scrollToBottom,
  };
}
