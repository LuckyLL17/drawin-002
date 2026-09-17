import { useEffect, useRef } from 'react';
import { PlaitElement } from '@plait/core';
import { useBoard } from '@plait-board/react-board';
import { usePresentation } from './presentation-context';

/**
 * Reconciles slide element ranges with the board children after edits.
 *
 * Plait mutates `board.children` in place, so identity doesn't change; track
 * the recursive id list instead and prune ranges whenever an element is
 * deleted (or replaced, e.g. undo). Viewport-only slides are always kept.
 */
export const useStaleSlideReconciler = (onStale?: (staleSlideIds: string[]) => void) => {
  const board = useBoard();
  const { presentation, pruneStale } = usePresentation();
  const knownSignatureRef = useRef<string | null>(null);
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  const hasRanges = presentation.slides.some((slide) => slide.elementIds?.length);
  // Recursive signature so deleting a node nested in a group is detected too
  // (its top-level root child id would otherwise stay unchanged).
  const signature = (() => {
    if (!hasRanges) {
      return '';
    }
    const ids: string[] = [];
    const walk = (element: PlaitElement) => {
      ids.push(element.id);
      element.children?.forEach(walk);
    };
    board.children.forEach(walk);
    return ids.join('|');
  })();

  useEffect(() => {
    if (knownSignatureRef.current === null) {
      knownSignatureRef.current = signature;
      return;
    }
    if (knownSignatureRef.current === signature || !hasRanges) {
      knownSignatureRef.current = signature;
      return;
    }
    knownSignatureRef.current = signature;
    const { staleSlideIds } = pruneStale();
    if (staleSlideIds.length) {
      onStaleRef.current?.(staleSlideIds);
    }
  }, [signature, hasRanges, pruneStale]);
};
