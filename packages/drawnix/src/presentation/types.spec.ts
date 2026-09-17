import { describe, expect, it } from 'vitest';
import type { PlaitElement } from '@plait/core';
import {
  PRESENTATION_DATA_TYPE,
  PresentationData,
  canMoveSlide,
  createPresentationData,
  createSlide,
  deleteSlide,
  getSlideElements,
  isPresentationData,
  moveSlide,
  parsePresentationData,
  pruneStaleSlides,
  renameSlide,
} from './types';

const makeElement = (id: string, children?: PlaitElement[]): PlaitElement =>
  ({ id, ...(children ? { children } : {}) }) as PlaitElement;

const buildPresentation = (): PresentationData =>
  createPresentationData([
    createSlide({ name: 'A', center: [0, 0], zoom: 1, elementIds: ['a'] }),
    createSlide({ name: 'B', center: [10, 10], zoom: 0.5, elementIds: ['b', 'missing'] }),
    createSlide({ name: 'C', center: [20, 20], zoom: 2 }),
  ]);

describe('presentation data model', () => {
  it('creates slides with unique ids and timestamps', () => {
    const a = createSlide({ center: [1, 2], zoom: 0.8 });
    const b = createSlide({ center: [1, 2], zoom: 0.8 });
    expect(a.id).not.toBe(b.id);
    expect(a.center).toEqual([1, 2]);
    expect(a.zoom).toBe(0.8);
    expect(a.elementIds).toBeUndefined();
    expect(a.createdAt).toBeGreaterThan(0);
  });

  it('renames, deletes and moves slides immutably', () => {
    const presentation = buildPresentation();
    const [first, second, third] = presentation.slides;

    const renamed = renameSlide(presentation, second.id, 'B2');
    expect(renamed.slides[1].name).toBe('B2');
    expect(presentation.slides[1].name).toBe('B');

    const moved = moveSlide(presentation, third.id, 0);
    expect(moved.slides.map((slide) => slide.id)).toEqual([third.id, first.id, second.id]);

    expect(moveSlide(presentation, first.id, 0)).toBe(presentation);

    const deleted = deleteSlide(presentation, second.id);
    expect(deleted.slides.map((slide) => slide.id)).toEqual([first.id, third.id]);
  });

  it('reports whether a slide can be reordered', () => {
    const presentation = buildPresentation();
    const [first, second, third] = presentation.slides;
    expect(canMoveSlide(presentation, first.id, 'up')).toBe(false);
    expect(canMoveSlide(presentation, first.id, 'down')).toBe(true);
    expect(canMoveSlide(presentation, third.id, 'down')).toBe(false);
    expect(canMoveSlide(presentation, second.id, 'up')).toBe(true);
    expect(canMoveSlide(presentation, 'unknown', 'up')).toBe(false);
  });

  it('prunes element ids that no longer exist and flags fully stale ranges', () => {
    const presentation = buildPresentation();
    const elements = [makeElement('a'), makeElement('b')];

    const result = pruneStaleSlides(presentation, elements);

    expect(result.staleSlideIds).toEqual([]);
    // first slide unchanged reference, second lost 'missing'
    expect(result.presentation.slides[0]).toBe(presentation.slides[0]);
    expect(result.presentation.slides[1].elementIds).toEqual(['b']);

    const allDeleted = pruneStaleSlides(presentation, []);
    expect(allDeleted.staleSlideIds).toEqual(
      expect.arrayContaining([presentation.slides[0].id, presentation.slides[1].id])
    );
    expect(allDeleted.presentation.slides[0].elementIds).toBeUndefined();
    expect(allDeleted.presentation.slides[1].elementIds).toBeUndefined();
  });

  it('resolves slide elements including nested children', () => {
    const presentation = buildPresentation();
    const elements = [
      makeElement('root', [makeElement('a'), makeElement('deep', [makeElement('b')])]),
    ];
    const resolved = getSlideElements(elements, presentation.slides[1]);
    expect(resolved.map((element) => element.id)).toEqual(['b']);
  });

  it('parses well-formed presentation data', () => {
    const parsed = parsePresentationData({
      type: PRESENTATION_DATA_TYPE,
      version: 1,
      slides: [
        {
          id: 's1',
          name: 'one',
          center: [1, 2],
          zoom: 1,
          elementIds: ['x'],
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });
    expect(parsed?.slides).toHaveLength(1);
    expect(isPresentationData(parsed)).toBe(true);
  });

  it('tolerates malformed and legacy payloads', () => {
    expect(parsePresentationData(null)).toBeNull();
    expect(parsePresentationData(undefined)).toBeNull();
    expect(parsePresentationData({})).toBeNull();
    expect(parsePresentationData({ type: 'something-else', slides: [] })).toBeNull();
    // invalid slides are dropped, valid ones kept
    const parsed = parsePresentationData({
      type: PRESENTATION_DATA_TYPE,
      version: 1,
      slides: [
        { id: 1, name: 'bad', center: [0, 0], zoom: 1 },
        { id: 'ok', name: 'good', center: [0, 0], zoom: 1 },
      ],
    });
    expect(parsed?.slides.map((slide) => slide.id)).toEqual(['ok']);
  });
});
