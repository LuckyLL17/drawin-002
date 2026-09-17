import { describe, expect, it, vi } from 'vitest';
import { PlaitBoard, PlaitElement } from '@plait/core';
import {
  PRESENTATION_DIMMED_CLASS_NAME,
  clearHighlightedElements,
  highlightSlideElements,
} from './highlight';
import { createSlide, PresentationSlide } from './types';

type FakeElement = {
  id: string;
  children?: FakeElement[];
  container: SVGGElement;
};

const createFakeElement = (id: string, children?: FakeElement[]): FakeElement => ({
  id,
  ...(children ? { children } : {}),
  container: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as SVGGElement,
});

const createFakeBoard = (children: FakeElement[]) => {
  vi.spyOn(PlaitElement, 'getContainerG').mockImplementation(
    (element: PlaitElement, options?: { suppressThrow?: boolean }) => {
      const found = children.find((child) => child.id === element.id);
      if (!found && options?.suppressThrow) {
        return null;
      }
      return (found ?? (element as FakeElement)).container;
    }
  );
  return { children: children as unknown as PlaitElement[] } as unknown as PlaitBoard;
};

const slideWith = (elementIds: string[]): PresentationSlide =>
  createSlide({ center: [0, 0], zoom: 1, elementIds });

describe('presentation element highlighting', () => {
  it('dims every top-level child when the slide has no range', () => {
    const a = createFakeElement('a');
    const b = createFakeElement('b');
    const board = createFakeBoard([a, b]);

    highlightSlideElements(board, createSlide({ center: [0, 0], zoom: 1 }));

    expect(a.container.classList.add).not.toHaveBeenCalled();
    expect(b.container.classList.add).not.toHaveBeenCalled();
  });

  it('dims children outside of the slide range and keeps referenced ones visible', () => {
    const a = createFakeElement('a');
    const b = createFakeElement('b');
    const c = createFakeElement('c');
    const board = createFakeBoard([a, b, c]);

    highlightSlideElements(board, slideWith(['b']));

    expect(a.container.classList.add).toHaveBeenCalledWith(PRESENTATION_DIMMED_CLASS_NAME);
    expect(b.container.classList.add).not.toHaveBeenCalled();
    expect(c.container.classList.add).toHaveBeenCalledWith(PRESENTATION_DIMMED_CLASS_NAME);
  });

  it('resolves referenced nested elements to their top-level root child', () => {
    const nested = createFakeElement('nested');
    const group = createFakeElement('group', [nested]);
    const other = createFakeElement('other');
    const board = createFakeBoard([group, other]);

    highlightSlideElements(board, slideWith(['nested']));

    expect(group.container.classList.add).not.toHaveBeenCalled();
    expect(other.container.classList.add).toHaveBeenCalledWith(PRESENTATION_DIMMED_CLASS_NAME);
  });

  it('ignores element ids that cannot be resolved', () => {
    const a = createFakeElement('a');
    const board = createFakeBoard([a]);

    highlightSlideElements(board, slideWith(['missing', 'a']));

    expect(a.container.classList.add).not.toHaveBeenCalled();
  });

  it('clears dimming from every child', () => {
    const a = createFakeElement('a');
    const b = createFakeElement('b');
    const board = createFakeBoard([a, b]);

    highlightSlideElements(board, slideWith(['a']));
    clearHighlightedElements(board);

    expect(a.container.classList.remove).toHaveBeenCalledWith(PRESENTATION_DIMMED_CLASS_NAME);
    expect(b.container.classList.remove).toHaveBeenCalledWith(PRESENTATION_DIMMED_CLASS_NAME);
  });
});
