import { PlaitBoard, PlaitElement } from '@plait/core';
import { PresentationSlide } from './types';

/**
 * During playback elements outside of the current slide's optional range are
 * dimmed via this class on their top-level container <g>.
 */
export const PRESENTATION_DIMMED_CLASS_NAME = 'presentation-dimmed-element';

/**
 * A referenced element may live inside a group. Dimming works on top-level
 * children only, so build an id -> root child map up-front.
 */
const buildRootChildMap = (board: PlaitBoard) => {
  const rootById = new Map<string, PlaitElement>();
  board.children.forEach((child) => {
    rootById.set(child.id, child);
    const walk = (element: PlaitElement) => {
      element.children?.forEach((descendant) => {
        rootById.set(descendant.id, child);
        walk(descendant);
      });
    };
    walk(child);
  });
  return rootById;
};

export const highlightSlideElements = (board: PlaitBoard, slide: PresentationSlide) => {
  clearHighlightedElements(board);
  if (!slide.elementIds?.length) {
    return;
  }

  const rootById = buildRootChildMap(board);
  const highlightedRoots = new Set<PlaitElement>();
  slide.elementIds.forEach((id) => {
    const root = rootById.get(id);
    if (root) {
      highlightedRoots.add(root);
    }
  });

  board.children.forEach((child) => {
    if (highlightedRoots.has(child)) {
      return;
    }
    const containerG = PlaitElement.getContainerG(child, { suppressThrow: true });
    containerG?.classList.add(PRESENTATION_DIMMED_CLASS_NAME);
  });
};

export const clearHighlightedElements = (board: PlaitBoard) => {
  board.children.forEach((child) => {
    const containerG = PlaitElement.getContainerG(child, { suppressThrow: true });
    containerG?.classList.remove(PRESENTATION_DIMMED_CLASS_NAME);
  });
};
