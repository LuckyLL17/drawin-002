import { describe, expect, it, vi } from 'vitest';

const updateViewportCalls: any[] = [];

vi.mock('@plait/core', () => ({
  clampZoomLevel: (zoom: number) => Math.min(2, Math.max(0.1, zoom)),
  getElementById: (board: any, id: string) =>
    board.children.find((element: any) => element.id === id),
  getRectangleByElements: (_board: any, elements: any[]) => ({
    x: Math.min(...elements.map((element) => element.x)),
    y: Math.min(...elements.map((element) => element.y)),
    width: 200,
    height: 100,
  }),
  getViewportContainerRect: () => ({ width: 1000, height: 800 }),
  BoardTransforms: {
    updateViewport: (...args: any[]) => updateViewportCalls.push(args),
  },
}));

import * as core from '@plait/core';
import {
  createPresentation,
  createPresentationPage,
  sanitizePresentations,
  validatePage,
} from './types';
import {
  getViewportCenter,
  getViewportForElements,
  navigateToPage,
  setViewportCenter,
} from './viewport';

const makeBoard = () => ({
  children: [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 300, y: 300 },
  ],
  viewport: { zoom: 1, origination: [100, 200] as [number, number] },
});

const lastViewportCall = () => updateViewportCalls.at(-1);

describe('presentation types', () => {
  it('validates pages without element range as always valid', () => {
    const page = createPresentationPage([0, 0], 1, '1');
    expect(validatePage(page, makeBoard().children)).toEqual({
      missingElementIds: [],
      isInvalid: false,
    });
  });

  it('reports missing elements but stays valid while one element exists', () => {
    const page = createPresentationPage([0, 0], 1, '1', ['a', 'gone']);
    expect(validatePage(page, makeBoard().children)).toEqual({
      missingElementIds: ['gone'],
      isInvalid: false,
    });
  });

  it('marks a page invalid only when every referenced element is gone', () => {
    const page = createPresentationPage([0, 0], 1, '1', ['x', 'y']);
    expect(validatePage(page, makeBoard().children)).toEqual({
      missingElementIds: ['x', 'y'],
      isInvalid: true,
    });
  });

  it('sanitizes malformed data coming from old or corrupt files', () => {
    const sanitized = sanitizePresentations([
      null,
      {
        pages: [
          null,
          { name: 42, zoom: 'oops', center: ['x', 1] },
          { id: 'keep', name: 'Fine', zoom: 2, center: [10, 20], elementIds: ['a', 7] },
        ],
      },
      'nope',
    ]);
    expect(sanitized).toHaveLength(1);
    const pages = sanitized[0].pages;
    expect(pages).toHaveLength(2);
    expect(pages[0].zoom).toBe(1);
    expect(pages[0].center).toEqual([0, 1]);
    expect(pages[1].id).toBe('keep');
    expect(pages[1].elementIds).toEqual(['a']);
  });

  it('creates named presentations and pages', () => {
    const page = createPresentationPage([1, 2], 1.5, 'Intro', ['a']);
    const presentation = createPresentation('Deck', [page]);
    expect(presentation.pages[0].name).toBe('Intro');
    expect(presentation.pages[0].elementIds).toEqual(['a']);
  });
});

describe('presentation viewport helpers', () => {
  it('derives the viewport center from origination and zoom', () => {
    const board = makeBoard();
    // origination (100,200), container 1000x800, zoom 1
    expect(getViewportCenter(board as unknown as core.PlaitBoard)).toEqual([600, 600]);
  });

  it('computes origination for a given center and zoom', () => {
    const board = makeBoard();
    setViewportCenter(board as unknown as core.PlaitBoard, [0, 0], 1);
    expect(lastViewportCall()[1]).toEqual([-500, -400]);
  });

  it('computes a fitted viewport for an element range', () => {
    const board = makeBoard();
    const target = getViewportForElements(board as unknown as core.PlaitBoard, ['a']);
    expect(target).not.toBeNull();
    // 200x100 content in 872x672 available area -> zoom clamps to max 2
    expect(target!.zoom).toBe(2);
    expect(target!.center).toEqual([100, 50]);
  });

  it('returns null when all focused elements were deleted', () => {
    const board = makeBoard();
    expect(getViewportForElements(board as unknown as core.PlaitBoard, ['deleted'])).toBeNull();
  });

  it('navigates with saved center/zoom when elements are missing', () => {
    const board = makeBoard();
    const page = createPresentationPage([120, 240], 0.5, '1', ['deleted']);
    navigateToPage(board as unknown as core.PlaitBoard, page);
    const last = lastViewportCall();
    expect(last[2]).toBe(0.5);
    expect(last[1]).toEqual([120 - 1000 / 0.5 / 2, 240 - 800 / 0.5 / 2]);
  });
});
