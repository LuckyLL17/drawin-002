import { describe, expect, it } from 'vitest';
import { PlaitBoard } from '@plait/core';
import { applyLoadedPresentation, readPresentationFromData, serializeAsJSON } from './json';
import { DrawnixExportedData, DrawnixExportedType } from './types';
import { createPresentationData, createSlide } from '../presentation/types';
import { setBoardPresentation } from '../presentation/presentation-context';

const createMockBoard = () =>
  ({
    children: [{ id: 'a' }, { id: 'b' }],
    viewport: { zoom: 1.5, origination: [10, 20] },
    theme: { themeColorMode: 'default' },
  }) as unknown as PlaitBoard;

const baseFileData = (): DrawnixExportedData => ({
  type: DrawnixExportedType.drawnix,
  version: 1,
  source: 'web',
  elements: [{ id: 'a' }, { id: 'b' }],
  viewport: { zoom: 1 },
});

describe('presentation-aware JSON serialization', () => {
  it('omits the presentation field when there are no slides', () => {
    const board = createMockBoard();
    const parsed = JSON.parse(serializeAsJSON(board));
    expect(parsed.presentation).toBeUndefined();
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.viewport).toEqual({ zoom: 1.5, origination: [10, 20] });
  });

  it('keeps presentation metadata attached to the board', () => {
    const board = createMockBoard();
    const presentation = createPresentationData([
      createSlide({ name: 'intro', center: [0, 0], zoom: 1, elementIds: ['a'] }),
    ]);
    setBoardPresentation(board, presentation);

    const parsed = JSON.parse(serializeAsJSON(board));
    expect(parsed.presentation.type).toBe('drawnix-presentation');
    expect(parsed.presentation.slides).toHaveLength(1);
    expect(parsed.presentation.slides[0].name).toBe('intro');
  });

  it('reads well-formed presentation metadata from file data', () => {
    const data = {
      ...baseFileData(),
      presentation: {
        type: 'drawnix-presentation',
        version: 1,
        slides: [{ id: 's1', name: 'x', center: [1, 2], zoom: 1, createdAt: 1, updatedAt: 1 }],
      },
    };
    expect(readPresentationFromData(data)?.slides[0].id).toBe('s1');
  });

  it('treats missing or malformed metadata as absent (legacy files)', () => {
    expect(readPresentationFromData(baseFileData())).toBeNull();
    expect(readPresentationFromData({ ...baseFileData(), presentation: null })).toBeNull();
    expect(
      readPresentationFromData({ ...baseFileData(), presentation: { weird: true } })
    ).toBeNull();
  });

  it('prunes ranges pointing at elements missing from the opened document', () => {
    const board = createMockBoard();
    const data: DrawnixExportedData = {
      ...baseFileData(),
      presentation: createPresentationData([
        createSlide({ name: 'ok', center: [0, 0], zoom: 1, elementIds: ['a'] }),
        createSlide({ name: 'ghost', center: [0, 0], zoom: 1, elementIds: ['x'] }),
      ]),
    };

    const presentation = applyLoadedPresentation(board, data);
    expect(presentation?.slides).toHaveLength(2);
    expect(presentation?.slides[0].elementIds).toEqual(['a']);
    // the ghost range is dropped entirely, the slide itself stays viewport-only
    expect(presentation?.slides[1].elementIds).toBeUndefined();
  });

  it('round-trips slides through JSON without losing ordering or fields', () => {
    const board = createMockBoard();
    const presentation = createPresentationData([
      createSlide({ name: 'first', center: [1, 2], zoom: 0.5, elementIds: ['a'] }),
      createSlide({ name: 'second', center: [3, 4], zoom: 2 }),
      createSlide({ name: 'third', center: [5, 6], zoom: 1, elementIds: ['a', 'b'] }),
    ]);
    setBoardPresentation(board, presentation);

    const parsed = JSON.parse(serializeAsJSON(board)) as DrawnixExportedData;
    const restored = applyLoadedPresentation(
      { ...board, children: parsed.elements } as unknown as PlaitBoard,
      parsed
    );

    expect(restored?.slides.map((slide) => slide.name)).toEqual(['first', 'second', 'third']);
    expect(restored?.slides[0]).toMatchObject({
      center: [1, 2],
      zoom: 0.5,
      elementIds: ['a'],
    });
    expect(restored?.slides[2].elementIds).toEqual(['a', 'b']);
  });
});
