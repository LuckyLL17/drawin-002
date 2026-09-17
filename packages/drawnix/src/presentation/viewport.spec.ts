import { describe, expect, it, vi } from 'vitest';
import {
  BoardTransforms,
  PlaitBoard,
  Viewport,
  clampZoomLevel,
  getRectangleByElements,
} from '@plait/core';
import {
  applySlideViewport,
  captureCurrentViewport,
  getOriginationForCenter,
  getViewportCenter,
  getViewportForElements,
  viewportsEqual,
} from './viewport';
import { createSlide } from './types';

const CONTAINER_WIDTH = 800;
const CONTAINER_HEIGHT = 600;

vi.mock('@plait/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plait/core')>();
  return {
    ...actual,
    BoardTransforms: {
      ...actual.BoardTransforms,
      updateViewport: vi.fn(),
    },
    getRectangleByElements: vi.fn(),
  };
});

const mockBoardContainer = () => {
  vi.spyOn(PlaitBoard, 'getBoardContainer').mockReturnValue({
    getBoundingClientRect: () => ({
      width: CONTAINER_WIDTH,
      height: CONTAINER_HEIGHT,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: CONTAINER_WIDTH,
      bottom: CONTAINER_HEIGHT,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLDivElement);
};

describe('presentation viewport helpers', () => {
  it('computes center from origination, zoom and container size', () => {
    mockBoardContainer();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 2, origination: [10, 20] },
    } as never as PlaitBoard;
    expect(getViewportCenter(board)).toEqual([10 + 800 / 2 / 2, 20 + 600 / 2 / 2]);
  });

  it('returns zero center when the board has no origination yet', () => {
    mockBoardContainer();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1 },
    } as never as PlaitBoard;
    expect(getViewportCenter(board)).toEqual([0, 0]);
  });

  it('computes the origination that centers a point', () => {
    mockBoardContainer();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1, origination: [0, 0] },
    } as never as PlaitBoard;
    expect(getOriginationForCenter(board, [400, 300], 1)).toEqual([0, 0]);
    expect(getOriginationForCenter(board, [500, 400], 2)).toEqual([
      500 - 800 / 2 / 2,
      400 - 600 / 2 / 2,
    ]);
  });

  it('applies a slide viewport with clamped zoom', () => {
    mockBoardContainer();
    vi.mocked(BoardTransforms.updateViewport).mockClear();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1, origination: [0, 0] },
    } as never as PlaitBoard;
    const slide = createSlide({ center: [400, 300], zoom: 0.8 });
    applySlideViewport(board, slide);
    expect(BoardTransforms.updateViewport).toHaveBeenCalledTimes(1);
    expect(vi.mocked(BoardTransforms.updateViewport).mock.calls[0][1]).toEqual(
      getOriginationForCenter(board, [400, 300], 0.8)
    );
    expect(vi.mocked(BoardTransforms.updateViewport).mock.calls[0][2]).toBe(0.8);

    // absurd zoom values are clamped by the core helper
    applySlideViewport(board, createSlide({ center: [0, 0], zoom: 999 }));
    expect(vi.mocked(BoardTransforms.updateViewport).mock.calls[1][2]).toBe(clampZoomLevel(999));
  });

  it('captures the current viewport', () => {
    mockBoardContainer();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1.5, origination: [5, 6] },
    } as never as PlaitBoard;
    expect(captureCurrentViewport(board)).toEqual({
      center: getViewportCenter(board),
      zoom: 1.5,
    });
  });

  it('frames elements inside the container with padding', () => {
    mockBoardContainer();
    vi.mocked(getRectangleByElements).mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1, origination: [0, 0] },
    } as never as PlaitBoard;

    const result = getViewportForElements(board, [{ id: 'x' } as never]);
    expect(result.center).toEqual([200, 150]);
    // available area is 800*0.76 x 600*0.76 = 608 x 456
    expect(result.zoom).toBeCloseTo(Math.min(608 / 400, 456 / 300), 5);
  });

  it('falls back to the current viewport for an empty element list', () => {
    mockBoardContainer();
    const board = {
      options: { hideScrollbar: false },
      viewport: { zoom: 1.25, origination: [1, 2] },
    } as never as PlaitBoard;
    expect(getViewportForElements(board, [])).toEqual(captureCurrentViewport(board));
  });

  it('compares viewports by zoom and origination', () => {
    expect(viewportsEqual({ zoom: 1 }, { zoom: 1 })).toBe(true);
    expect(viewportsEqual({ zoom: 1, origination: [1, 2] }, { zoom: 1, origination: [1, 2] })).toBe(
      true
    );
    expect(viewportsEqual({ zoom: 1, origination: [1, 2] }, { zoom: 2, origination: [1, 2] })).toBe(
      false
    );
  });
});
