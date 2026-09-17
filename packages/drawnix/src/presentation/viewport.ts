import {
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  Viewport,
  clampZoomLevel,
  getRectangleByElements,
  getViewportContainerRect,
} from '@plait/core';
import { PresentationSlide } from './types';

/**
 * Center of the current viewport in board coordinates.
 *
 * Viewport model: `origination` is the board point shown at the top-left
 * corner of the container, so center = origination + containerSize / 2 / zoom.
 */
export const getViewportCenter = (board: PlaitBoard): [number, number] => {
  const { origination } = board.viewport;
  if (!origination) {
    return [0, 0];
  }
  const { width, height } = getViewportContainerRect(board);
  const zoom = board.viewport.zoom || 1;
  return [origination[0] + width / 2 / zoom, origination[1] + height / 2 / zoom];
};

/** Compute the origination that places `center` in the middle of the container. */
export const getOriginationForCenter = (
  board: PlaitBoard,
  center: [number, number],
  zoom: number
): [number, number] => {
  const { width, height } = getViewportContainerRect(board);
  return [center[0] - width / 2 / zoom, center[1] - height / 2 / zoom];
};

/** Move the board to the viewport saved by a slide. */
export const applySlideViewport = (board: PlaitBoard, slide: PresentationSlide) => {
  const zoom = clampZoomLevel(slide.zoom);
  const origination = getOriginationForCenter(board, slide.center, zoom);
  BoardTransforms.updateViewport(board, origination, zoom);
};

export interface CapturedViewport {
  center: [number, number];
  zoom: number;
}

export const captureCurrentViewport = (board: PlaitBoard): CapturedViewport => ({
  center: getViewportCenter(board),
  zoom: board.viewport.zoom || 1,
});

/**
 * Compute viewport center + zoom that frames the given elements, with a small
 * padding around them. Falls back to the current viewport when no element has
 * a readable rectangle (e.g. empty board in jsdom).
 */
export const getViewportForElements = (
  board: PlaitBoard,
  elements: PlaitElement[],
  paddingRatio = 0.12
): CapturedViewport => {
  if (!elements.length) {
    return captureCurrentViewport(board);
  }
  const rectangle = getRectangleByElements(board, elements, true);
  const { width: containerWidth, height: containerHeight } = getViewportContainerRect(board);
  if (
    !rectangle ||
    !containerWidth ||
    !containerHeight ||
    rectangle.width <= 0 ||
    rectangle.height <= 0
  ) {
    return captureCurrentViewport(board);
  }
  const availableWidth = containerWidth * (1 - paddingRatio * 2);
  const availableHeight = containerHeight * (1 - paddingRatio * 2);
  const zoom = clampZoomLevel(
    Math.min(availableWidth / rectangle.width, availableHeight / rectangle.height)
  );
  return {
    center: [rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2],
    zoom,
  };
};

export const viewportsEqual = (a: Viewport, b: Viewport): boolean =>
  a.zoom === b.zoom &&
  (a.origination?.[0] ?? 0) === (b.origination?.[0] ?? 0) &&
  (a.origination?.[1] ?? 0) === (b.origination?.[1] ?? 0);
