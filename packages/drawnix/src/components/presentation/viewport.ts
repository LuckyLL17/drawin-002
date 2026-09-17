import {
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  Viewport,
  clampZoomLevel,
  getElementById,
  getRectangleByElements,
  getViewportContainerRect,
} from '@plait/core';
import { PresentationPage } from './types';

/** Distance (in screen pixels) preserved around the focused element range. */
const FIT_PADDING = 64;

/**
 * Return the center point (board coordinates) of the current viewport.
 */
export const getViewportCenter = (board: PlaitBoard): [number, number] => {
  const { width, height } = getViewportContainerRect(board);
  const zoom = board.viewport.zoom || 1;
  const originationX = board.viewport.origination?.[0] ?? 0;
  const originationY = board.viewport.origination?.[1] ?? 0;
  return [originationX + width / 2 / zoom, originationY + height / 2 / zoom];
};

/**
 * Apply a saved viewport (center + zoom) to the board.
 */
export const setViewportCenter = (
  board: PlaitBoard,
  center: [number, number],
  zoom: number
) => {
  const { width, height } = getViewportContainerRect(board);
  const nextZoom = clampZoomLevel(zoom);
  const origination: [number, number] = [
    center[0] - width / 2 / nextZoom,
    center[1] - height / 2 / nextZoom,
  ];
  BoardTransforms.updateViewport(board, origination, nextZoom);
};

/**
 * Compute the zoom and center needed so that the given element range fits
 * inside the viewport with padding. Returns `null` when no resolvable element
 * is available.
 */
export const getViewportForElements = (
  board: PlaitBoard,
  elementIds: string[]
): { center: [number, number]; zoom: number } | null => {
  const elements = elementIds
    .map((id) => getElementById(board, id))
    .filter((element): element is PlaitElement => !!element);
  if (elements.length === 0) {
    return null;
  }
  const rectangle = getRectangleByElements(board, elements, true);
  if (!rectangle || (rectangle.width === 0 && rectangle.height === 0)) {
    return null;
  }
  const { width, height } = getViewportContainerRect(board);
  const availableWidth = Math.max(width - FIT_PADDING * 2, 1);
  const availableHeight = Math.max(height - FIT_PADDING * 2, 1);
  const zoom = clampZoomLevel(
    Math.min(availableWidth / rectangle.width, availableHeight / rectangle.height)
  );
  return {
    center: [rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2],
    zoom,
  };
};

/**
 * Navigate to a page. When the page has an element range whose elements still
 * exist, the viewport is re-fitted to them; otherwise the saved center/zoom is
 * used as a fallback.
 */
export const navigateToPage = (board: PlaitBoard, page: PresentationPage) => {
  if (page.elementIds && page.elementIds.length > 0) {
    const target = getViewportForElements(board, page.elementIds);
    if (target) {
      setViewportCenter(board, target.center, target.zoom);
      return;
    }
  }
  setViewportCenter(board, page.center, page.zoom);
};

export const cloneViewport = (viewport: Viewport): Viewport => ({
  ...viewport,
  origination: viewport.origination ? ([...viewport.origination] as [number, number]) : undefined,
});
