import { PlaitBoard, PlaitElement, getSelectedElements } from '@plait/core';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useBoard } from '@plait-board/react-board';
import {
  PresentationData,
  PresentationSlide,
  createPresentationData,
  createSlide,
  deleteSlide,
  moveSlide,
  pruneStaleSlides,
} from './types';
import { captureCurrentViewport, getViewportForElements } from './viewport';

/** Presentation metadata is attached to the board object for serialization. */
export const BOARD_PRESENTATION_KEY = '__drawnixPresentation__' as const;

declare module '@plait/core' {
  interface PlaitBoard {
    __drawnixPresentation__?: PresentationData;
  }
}

export interface PresentationContextValue {
  presentation: PresentationData;
  /** Set/replace the whole presentation (also used when opening a file). */
  setPresentation: (
    next: PresentationData | null,
    options?: { prune?: boolean; silent?: boolean }
  ) => void;
  addSlide: (options?: Partial<Pick<PresentationSlide, 'name'>>) => PresentationSlide;
  addSlideFromSelection: (
    options?: Partial<Pick<PresentationSlide, 'name'>>
  ) => PresentationSlide | null;
  updateSlide: (slideId: string, patch: Partial<PresentationSlide>) => void;
  removeSlide: (slideId: string) => void;
  reorderSlide: (slideId: string, direction: 'up' | 'down') => void;
  moveSlideTo: (slideId: string, targetIndex: number) => void;
  /** Drop element ranges pointing at elements that no longer exist. */
  pruneStale: (elements?: PlaitElement[]) => { staleSlideIds: string[] };
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

const clonePresentation = (presentation: PresentationData | null | undefined): PresentationData =>
  presentation
    ? {
        ...presentation,
        slides: presentation.slides.map((slide) => ({
          ...slide,
          center: [slide.center[0], slide.center[1]] as [number, number],
          elementIds: slide.elementIds ? [...slide.elementIds] : undefined,
        })),
      }
    : createPresentationData();

export interface PresentationProviderProps {
  children: React.ReactNode;
  /** Fired whenever presentation metadata changes (drives persistence). */
  onPresentationChange?: (presentation: PresentationData | null) => void;
  /**
   * Receives a setter that replaces all presentation metadata. Used by flows
   * outside React render (e.g. opening a file from a menu) to push loaded data
   * into the provider.
   */
  onRegisterApi?: (api: {
    load: (presentation: PresentationData | null, options?: { prune?: boolean }) => void;
  }) => void;
}

export const PresentationProvider: React.FC<PresentationProviderProps> = ({
  children,
  onPresentationChange,
  onRegisterApi,
}) => {
  const board = useBoard();
  const initial = useMemo<PresentationData>(
    // Prune ranges against current children on mount. This covers documents
    // re-opened with slides referencing elements that were since deleted.
    () => {
      const loaded = clonePresentation(board[BOARD_PRESENTATION_KEY]);
      const { presentation: pruned } = pruneStaleSlides(loaded, board.children);
      if (pruned !== loaded) {
        board[BOARD_PRESENTATION_KEY] = pruned;
      }
      return pruned;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board]
  );
  const [presentation, setPresentationState] = useState<PresentationData>(initial);
  const onPresentationChangeRef = useRef(onPresentationChange);
  onPresentationChangeRef.current = onPresentationChange;

  useEffect(() => {
    board[BOARD_PRESENTATION_KEY] = presentation;
  }, [board, presentation]);

  const setPresentation = useCallback<PresentationContextValue['setPresentation']>(
    (next, options) => {
      const { prune = false, silent = false } = options || {};
      setPresentationState((current) => {
        let value = next ? clonePresentation(next) : createPresentationData();
        if (prune) {
          const result = pruneStaleSlides(value, board.children);
          value = result.presentation;
        }
        board[BOARD_PRESENTATION_KEY] = value;
        if (!silent) {
          onPresentationChangeRef.current?.(value.slides.length ? value : null);
        }
        return value;
      });
    },
    [board]
  );

  const onRegisterApiRef = useRef(onRegisterApi);
  onRegisterApiRef.current = onRegisterApi;

  useEffect(() => {
    onRegisterApiRef.current?.({
      load: (incoming, options) => setPresentation(incoming, { prune: options?.prune }),
    });
  }, [setPresentation]);

  const commit = useCallback(
    (updater: (current: PresentationData) => PresentationData) => {
      setPresentationState((current) => {
        const next = updater(current);
        board[BOARD_PRESENTATION_KEY] = next;
        onPresentationChangeRef.current?.(next.slides.length ? next : null);
        return next;
      });
    },
    [board]
  );

  const addSlide = useCallback<PresentationContextValue['addSlide']>(
    (options) => {
      const slide = createSlide({
        name: options?.name ?? '',
        ...captureCurrentViewport(board),
      });
      commit((current) => ({ ...current, slides: [...current.slides, slide] }));
      return slide;
    },
    [board, commit]
  );

  const addSlideFromSelection = useCallback<PresentationContextValue['addSlideFromSelection']>(
    (options) => {
      const selected = getSelectedElements(board);
      if (!selected.length) {
        return null;
      }
      // range stores top-level children so dimming/highlighting stays stable
      const rootIds: string[] = [];
      board.children.forEach((child) => {
        if (selected.includes(child)) {
          rootIds.push(child.id);
          return;
        }
        let includes = false;
        const walk = (element: PlaitElement) => {
          if (includes) {
            return;
          }
          if (selected.includes(element)) {
            includes = true;
          }
          element.children?.forEach(walk);
        };
        walk(child);
        if (includes) {
          rootIds.push(child.id);
        }
      });
      const slide = createSlide({
        name: options?.name ?? '',
        ...getViewportForElements(board, selected),
        elementIds: rootIds,
      });
      commit((current) => ({ ...current, slides: [...current.slides, slide] }));
      return slide;
    },
    [board, commit]
  );

  const updateSlide = useCallback<PresentationContextValue['updateSlide']>(
    (slideId, patch) => {
      commit((current) => ({
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === slideId ? { ...slide, ...patch, updatedAt: Date.now() } : slide
        ),
      }));
    },
    [commit]
  );

  const removeSlide = useCallback<PresentationContextValue['removeSlide']>(
    (slideId) => {
      commit((current) => deleteSlide(current, slideId));
    },
    [commit]
  );

  const moveSlideTo = useCallback<PresentationContextValue['moveSlideTo']>(
    (slideId, targetIndex) => {
      commit((current) => moveSlide(current, slideId, targetIndex));
    },
    [commit]
  );

  const reorderSlide = useCallback<PresentationContextValue['reorderSlide']>(
    (slideId, direction) => {
      const index = presentation.slides.findIndex((slide) => slide.id === slideId);
      if (index === -1) {
        return;
      }
      moveSlideTo(slideId, direction === 'up' ? index - 1 : index + 1);
    },
    [moveSlideTo, presentation.slides]
  );

  const pruneStale = useCallback<PresentationContextValue['pruneStale']>(
    (elements) => {
      let staleSlideIds: string[] = [];
      commit((current) => {
        const result = pruneStaleSlides(current, elements ?? board.children);
        staleSlideIds = result.staleSlideIds;
        return result.presentation;
      });
      return { staleSlideIds };
    },
    [board, commit]
  );

  const value = useMemo<PresentationContextValue>(
    () => ({
      presentation,
      setPresentation,
      addSlide,
      addSlideFromSelection,
      updateSlide,
      removeSlide,
      reorderSlide,
      moveSlideTo,
      pruneStale,
    }),
    [
      presentation,
      setPresentation,
      addSlide,
      addSlideFromSelection,
      updateSlide,
      removeSlide,
      reorderSlide,
      moveSlideTo,
      pruneStale,
    ]
  );

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
};

export const usePresentation = (): PresentationContextValue => {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error('The `usePresentation` hook must be used inside the <PresentationProvider>.');
  }
  return context;
};

/** Convenience hook for components that also need the board. */
export const usePresentationBoard = (): PlaitBoard => useBoard();

export const getBoardPresentation = (board: PlaitBoard): PresentationData | null =>
  board[BOARD_PRESENTATION_KEY] ?? null;

export const setBoardPresentation = (board: PlaitBoard, presentation: PresentationData | null) => {
  if (presentation && presentation.slides.length) {
    board[BOARD_PRESENTATION_KEY] = presentation;
  } else {
    delete board[BOARD_PRESENTATION_KEY];
  }
};
