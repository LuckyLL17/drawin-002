import { PlaitElement } from '@plait/core';

/**
 * A single page of a presentation. A page stores the viewport center (in
 * board coordinates) and zoom used while presenting, plus an optional range of
 * element ids that the page focuses on. The element range is informational —
 * deleted elements are tolerated and reported as "invalid" instead of
 * breaking the page.
 */
export interface PresentationPage {
  id: string;
  name: string;
  /** Center of the saved viewport, in board (unzoomed) coordinates. */
  center: [number, number];
  zoom: number;
  /** Optional element range the page focuses on. */
  elementIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Presentation {
  id: string;
  name: string;
  pages: PresentationPage[];
  createdAt: number;
  updatedAt: number;
}

/** Metadata persisted into `.drawnix` JSON files under the `presentations` key. */
export type PresentationsData = Presentation[];

let presentationIdCounter = 0;

export const createPresentationId = () => {
  presentationIdCounter += 1;
  return `presentation:${Date.now().toString(36)}:${presentationIdCounter.toString(36)}`;
};

export const createPageId = () => {
  presentationIdCounter += 1;
  return `presentation-page:${Date.now().toString(36)}:${presentationIdCounter.toString(36)}`;
};

export const createPresentationPage = (
  center: [number, number],
  zoom: number,
  name: string,
  elementIds: string[] = []
): PresentationPage => {
  const now = Date.now();
  return {
    id: createPageId(),
    name,
    center,
    zoom,
    elementIds: elementIds.length ? [...elementIds] : undefined,
    createdAt: now,
    updatedAt: now,
  };
};

export const createPresentation = (name: string, pages: PresentationPage[] = []) => {
  const now = Date.now();
  return {
    id: createPresentationId(),
    name,
    pages,
    createdAt: now,
    updatedAt: now,
  } satisfies Presentation;
};

export interface PageValidation {
  /** Element ids referenced by the page that no longer exist on the board. */
  missingElementIds: string[];
  /** True when the page references an element range but every element is gone. */
  isInvalid: boolean;
}

/**
 * Validate a page against the current board children. Pages without an
 * element range are always valid; pages with a range stay valid as long as at
 * least one referenced element still exists.
 */
export const validatePage = (
  page: PresentationPage,
  elements: PlaitElement[]
): PageValidation => {
  if (!page.elementIds || page.elementIds.length === 0) {
    return { missingElementIds: [], isInvalid: false };
  }
  const existingIds = new Set(elements.map((element) => element.id));
  const missingElementIds = page.elementIds.filter((id) => !existingIds.has(id));
  return {
    missingElementIds,
    isInvalid: missingElementIds.length === page.elementIds.length,
  };
};

export const sanitizePresentations = (data: unknown): Presentation[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  const now = Date.now();
  return data
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, presentationIndex) => {
      const rawPages = Array.isArray(item.pages) ? item.pages : [];
      const pages = rawPages
        .filter((page): page is Record<string, unknown> => !!page && typeof page === 'object')
        .map((page, pageIndex) => {
          const center = Array.isArray(page.center)
            ? ([Number(page.center[0]) || 0, Number(page.center[1]) || 0] as [number, number])
            : ([0, 0] as [number, number]);
          return {
            id: typeof page.id === 'string' && page.id ? page.id : createPageId(),
            name: typeof page.name === 'string' ? page.name : `${pageIndex + 1}`,
            center,
            zoom: Number.isFinite(Number(page.zoom)) ? Number(page.zoom) : 1,
            elementIds: Array.isArray(page.elementIds)
              ? page.elementIds.filter((id): id is string => typeof id === 'string')
              : undefined,
            createdAt: Number(page.createdAt) || now,
            updatedAt: Number(page.updatedAt) || now,
          } satisfies PresentationPage;
        });
      return {
        id: typeof item.id === 'string' && item.id ? item.id : createPresentationId(),
        name:
          typeof item.name === 'string' && item.name
            ? item.name
            : `Presentation ${presentationIndex + 1}`,
        pages,
        createdAt: Number(item.createdAt) || now,
        updatedAt: Number(item.updatedAt) || now,
      } satisfies Presentation;
    });
};
