import { PlaitElement, Viewport } from '@plait/core';

/**
 * Metadata of a single presentation page ("slide").
 *
 * A page always stores the exact viewport (center point in board coordinates
 * plus zoom) so playback is deterministic. `elementIds` is an optional range
 * of elements that are highlighted while the page is presented.
 */
export interface PresentationSlide {
  id: string;
  name: string;
  /** Viewport center in board coordinates. */
  center: [number, number];
  zoom: number;
  /** Optional range of elements that belong to this page. */
  elementIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PresentationData {
  type: 'drawnix-presentation';
  version: number;
  slides: PresentationSlide[];
}

export const PRESENTATION_DATA_TYPE = 'drawnix-presentation';
export const PRESENTATION_VERSION = 1;

export const createPresentationData = (slides: PresentationSlide[] = []): PresentationData => ({
  type: PRESENTATION_DATA_TYPE,
  version: PRESENTATION_VERSION,
  slides,
});

export const isPresentationData = (value: unknown): value is PresentationData => {
  const data = value as PresentationData | undefined | null;
  return (
    !!data &&
    typeof data === 'object' &&
    data.type === PRESENTATION_DATA_TYPE &&
    Array.isArray(data.slides)
  );
};

/**
 * Parse presentation metadata from an arbitrary (possibly old or hand-edited)
 * JSON payload. Never throws — invalid data is treated as "no presentation"
 * so legacy files keep loading.
 */
export const parsePresentationData = (value: unknown): PresentationData | null => {
  if (!isPresentationData(value)) {
    return null;
  }
  const slides = value.slides
    .filter((slide): slide is PresentationSlide => isPresentationSlide(slide))
    .map((slide) => normalizeSlide(slide));
  return createPresentationData(slides);
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isPresentationSlide = (value: unknown): value is PresentationSlide => {
  const slide = value as PresentationSlide | undefined | null;
  return (
    !!slide &&
    typeof slide === 'object' &&
    typeof slide.id === 'string' &&
    typeof slide.name === 'string' &&
    Array.isArray(slide.center) &&
    slide.center.length === 2 &&
    isFiniteNumber(slide.center[0]) &&
    isFiniteNumber(slide.center[1]) &&
    isFiniteNumber(slide.zoom) &&
    (slide.elementIds === undefined ||
      (Array.isArray(slide.elementIds) && slide.elementIds.every((id) => typeof id === 'string')))
  );
};

export const normalizeSlide = (slide: PresentationSlide): PresentationSlide => ({
  id: slide.id,
  name: slide.name,
  center: [slide.center[0], slide.center[1]],
  zoom: slide.zoom,
  elementIds: slide.elementIds ? [...slide.elementIds] : undefined,
  createdAt: typeof slide.createdAt === 'number' ? slide.createdAt : Date.now(),
  updatedAt: typeof slide.updatedAt === 'number' ? slide.updatedAt : Date.now(),
});

export const createSlideId = (): string =>
  `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface CreateSlideOptions {
  name?: string;
  center: [number, number];
  zoom: number;
  elementIds?: string[];
}

export const createSlide = (options: CreateSlideOptions): PresentationSlide => {
  const now = Date.now();
  return {
    id: createSlideId(),
    name: options.name ?? '',
    center: [options.center[0], options.center[1]],
    zoom: options.zoom,
    elementIds: options.elementIds ? [...options.elementIds] : undefined,
    createdAt: now,
    updatedAt: now,
  };
};

export const renameSlide = (
  presentation: PresentationData,
  slideId: string,
  name: string
): PresentationData => ({
  ...presentation,
  slides: presentation.slides.map((slide) =>
    slide.id === slideId ? { ...slide, name, updatedAt: Date.now() } : slide
  ),
});

export const deleteSlide = (presentation: PresentationData, slideId: string): PresentationData => ({
  ...presentation,
  slides: presentation.slides.filter((slide) => slide.id !== slideId),
});

export const moveSlide = (
  presentation: PresentationData,
  slideId: string,
  targetIndex: number
): PresentationData => {
  const fromIndex = presentation.slides.findIndex((slide) => slide.id === slideId);
  if (fromIndex === -1) {
    return presentation;
  }
  const clampedTarget = Math.max(0, Math.min(targetIndex, presentation.slides.length - 1));
  if (clampedTarget === fromIndex) {
    return presentation;
  }
  const slides = [...presentation.slides];
  const [slide] = slides.splice(fromIndex, 1);
  slides.splice(clampedTarget, 0, slide);
  return { ...presentation, slides };
};

/** Sort order helpers used by the up/down buttons of the panel. */
export const canMoveSlide = (
  presentation: PresentationData,
  slideId: string,
  direction: 'up' | 'down'
): boolean => {
  const index = presentation.slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) {
    return false;
  }
  return direction === 'up' ? index > 0 : index < presentation.slides.length - 1;
};

/**
 * Remove element ids that no longer exist on the board. Slides whose whole
 * range has been deleted keep working (viewport-only), they are just flagged
 * through the returned map so the UI can explain what happened.
 *
 * Returns a new presentation object only when something actually changed.
 */
export const pruneStaleSlides = (
  presentation: PresentationData,
  elements: PlaitElement[]
): { presentation: PresentationData; staleSlideIds: string[] } => {
  const existingIds = new Set<string>();
  const collectIds = (element: PlaitElement) => {
    existingIds.add(element.id);
    element.children?.forEach(collectIds);
  };
  elements.forEach(collectIds);

  const staleSlideIds: string[] = [];
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    if (!slide.elementIds?.length) {
      return slide;
    }
    const validIds = slide.elementIds.filter((id) => existingIds.has(id));
    if (validIds.length === slide.elementIds.length) {
      return slide;
    }
    changed = true;
    if (validIds.length === 0) {
      staleSlideIds.push(slide.id);
    }
    return {
      ...slide,
      elementIds: validIds.length ? validIds : undefined,
      updatedAt: Date.now(),
    };
  });

  return {
    presentation: changed ? { ...presentation, slides } : presentation,
    staleSlideIds,
  };
};

/** Resolve the (still existing) elements referenced by a slide. */
export const getSlideElements = (
  elements: PlaitElement[],
  slide: PresentationSlide
): PlaitElement[] => {
  if (!slide.elementIds?.length) {
    return [];
  }
  const byId = new Map<string, PlaitElement>();
  const collect = (element: PlaitElement) => {
    byId.set(element.id, element);
    element.children?.forEach(collect);
  };
  elements.forEach(collect);
  return slide.elementIds
    .map((id) => byId.get(id))
    .filter((element): element is PlaitElement => !!element);
};

export type { Viewport };
