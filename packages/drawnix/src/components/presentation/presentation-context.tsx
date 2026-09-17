import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BoardTransforms,
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
  PlaitPointerType,
  Transforms,
  Viewport,
} from '@plait/core';
import { DrawnixBoard } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { cloneViewport, getViewportCenter, navigateToPage } from './viewport';
import {
  Presentation,
  PresentationPage,
  createPresentation,
  createPresentationPage,
  sanitizePresentations,
  validatePage,
} from './types';

export interface PresentingState {
  presentationId: string;
  /** Index of the current page in the presentation's pages array. */
  pageIndex: number;
}

interface PresentationContextValue {
  presentations: Presentation[];
  activePresentationId: string | null;
  activePresentation: Presentation | null;
  setActivePresentationId: (id: string | null) => void;
  replacePresentations: (presentations: unknown) => void;
  addPresentation: (name?: string) => string;
  renamePresentation: (id: string, name: string) => void;
  removePresentation: (id: string) => void;
  addPage: (presentationId?: string, fallbackPresentationName?: string) => string | null;
  addPageFromSelection: (
    presentationId?: string,
    fallbackPresentationName?: string
  ) => string | null;
  updatePage: (
    presentationId: string,
    pageId: string,
    patch: Partial<Pick<PresentationPage, 'name' | 'center' | 'zoom' | 'elementIds'>>
  ) => void;
  renamePage: (presentationId: string, pageId: string, name: string) => void;
  removePage: (presentationId: string, pageId: string) => void;
  reorderPage: (presentationId: string, fromIndex: number, toIndex: number) => void;
  getPageValidation: (page: PresentationPage) => ReturnType<typeof validatePage>;
  presenting: PresentingState | null;
  startPresenting: (presentationId?: string, pageIndex?: number) => void;
  stopPresenting: () => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (pageIndex: number) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

export const PresentationProvider: React.FC<{
  board: PlaitBoard;
  initialPresentations?: unknown;
  onPresentationsChange?: (presentations: Presentation[]) => void;
  onPresentingChange?: (presenting: boolean) => void;
  children: React.ReactNode;
}> = ({ board, initialPresentations, onPresentationsChange, onPresentingChange, children }) => {
  const { t } = useI18n();
  const initialPresentationsRef = useRef<Presentation[] | undefined>(undefined);
  if (initialPresentationsRef.current === undefined) {
    initialPresentationsRef.current = sanitizePresentations(initialPresentations);
  }
  const [presentations, setPresentations] = useState<Presentation[]>(
    initialPresentationsRef.current
  );
  const [activePresentationId, setActivePresentationId] = useState<string | null>(
    initialPresentationsRef.current[0]?.id ?? null
  );
  const [presenting, setPresenting] = useState<PresentingState | null>(null);

  const onPresentationsChangeRef = useRef(onPresentationsChange);
  onPresentationsChangeRef.current = onPresentationsChange;

  const boardRef = useRef(board);
  boardRef.current = board;

  const presentationsRef = useRef(presentations);
  presentationsRef.current = presentations;

  const activePresentationIdRef = useRef(activePresentationId);
  activePresentationIdRef.current = activePresentationId;

  const presentingRef = useRef<PresentingState | null>(presenting);
  presentingRef.current = presenting;

  // Snapshot of the editing state (viewport + active tool), restored when
  // presenting ends.
  const restoredViewportRef = useRef<Viewport | null>(null);
  const restoredPointerRef = useRef<PlaitBoard['pointer'] | null>(null);

  // Keep the board object in sync so JSON serialization and other imperative
  // flows always see the latest presentation metadata.
  useEffect(() => {
    (board as DrawnixBoard).presentations = presentations;
    onPresentationsChangeRef.current?.(presentations);
  }, [board, presentations]);

  // Allow file loading / board clearing (imperative flows outside React) to
  // replace the presentation metadata.
  useEffect(() => {
    const drawnixBoard = board as DrawnixBoard;
    drawnixBoard.replacePresentations = (data: unknown) => {
      const next = sanitizePresentations(data);
      setPresentations(next);
      setActivePresentationId(next[0]?.id ?? null);
      // Restore editing state in case a file is opened mid-presentation.
      drawnixBoard.options.readonly = false;
      restoredViewportRef.current = null;
      restoredPointerRef.current = null;
      setPresenting(null);
    };
    return () => {
      delete drawnixBoard.replacePresentations;
    };
  }, [board]);

  // Exit presenting if the active presentation disappears.
  useEffect(() => {
    if (presenting && !presentations.some((item) => item.id === presenting.presentationId)) {
      setPresenting(null);
    }
  }, [presentations, presenting]);

  const onPresentingChangeRef = useRef(onPresentingChange);
  onPresentingChangeRef.current = onPresentingChange;

  useEffect(() => {
    onPresentingChangeRef.current?.(presenting !== null);
  }, [presenting]);

  const activePresentation = useMemo(
    () => presentations.find((presentation) => presentation.id === activePresentationId) ?? null,
    [presentations, activePresentationId]
  );

  const replacePresentations = useCallback((data: unknown) => {
    const next = sanitizePresentations(data);
    setPresentations(next);
    setActivePresentationId(next[0]?.id ?? null);
  }, []);

  const addPresentation = useCallback(
    (name?: string) => {
      const presentation = createPresentation(
        name ?? `Presentation ${presentations.length + 1}`
      );
      setPresentations((current) => [...current, presentation]);
      setActivePresentationId(presentation.id);
      return presentation.id;
    },
    [presentations.length]
  );

  const renamePresentation = useCallback((id: string, name: string) => {
    setPresentations((current) =>
      current.map((presentation) =>
        presentation.id === id ? { ...presentation, name, updatedAt: Date.now() } : presentation
      )
    );
  }, []);

  const removePresentation = useCallback((id: string) => {
    setPresentations((current) => current.filter((presentation) => presentation.id !== id));
    setActivePresentationId((currentId) => {
      if (currentId !== id) {
        return currentId;
      }
      const remaining = presentationsRef.current.filter((item) => item.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, []);

  const buildPageFromViewport = useCallback((elements: PlaitElement[]) => {
    const currentBoard = boardRef.current;
    const center = getViewportCenter(currentBoard);
    const elementIds = elements.map((element) => element.id).filter(Boolean) as string[];
    return createPresentationPage(center, currentBoard.viewport.zoom || 1, '', elementIds);
  }, []);

  const appendPage = useCallback(
    (elements: PlaitElement[], presentationId?: string, fallbackPresentationName?: string) => {
      const targetId = presentationId ?? activePresentationIdRef.current;
      const page = buildPageFromViewport(elements);
      if (!targetId) {
        const namedPage = { ...page, name: '1' };
        const presentation = createPresentation(
          fallbackPresentationName ?? `Presentation ${presentationsRef.current.length + 1}`,
          [namedPage]
        );
        setPresentations((current) => [...current, presentation]);
        setActivePresentationId(presentation.id);
        return namedPage.id;
      }
      let addedPageId: string | null = null;
      setPresentations((current) =>
        current.map((presentation) => {
          if (presentation.id !== targetId) {
            return presentation;
          }
          const namedPage = {
            ...page,
            name: page.name || `${presentation.pages.length + 1}`,
          };
          addedPageId = namedPage.id;
          return {
            ...presentation,
            pages: [...presentation.pages, namedPage],
            updatedAt: Date.now(),
          };
        })
      );
      return addedPageId ?? page.id;
    },
    [buildPageFromViewport]
  );

  const addPage = useCallback(
    (presentationId?: string, fallbackPresentationName?: string) =>
      appendPage([], presentationId, fallbackPresentationName),
    [appendPage]
  );

  const addPageFromSelection = useCallback(
    (presentationId?: string, fallbackPresentationName?: string) => {
      const selectedElements = getSelectedElements(boardRef.current);
      return appendPage(selectedElements, presentationId, fallbackPresentationName);
    },
    [appendPage]
  );

  const updatePage = useCallback(
    (
      presentationId: string,
      pageId: string,
      patch: Partial<Pick<PresentationPage, 'name' | 'center' | 'zoom' | 'elementIds'>>
    ) => {
      setPresentations((current) =>
        current.map((presentation) =>
          presentation.id !== presentationId
            ? presentation
            : {
                ...presentation,
                updatedAt: Date.now(),
                pages: presentation.pages.map((page) =>
                  page.id === pageId ? { ...page, ...patch, updatedAt: Date.now() } : page
                ),
              }
        )
      );
    },
    []
  );

  const renamePage = useCallback(
    (presentationId: string, pageId: string, name: string) => {
      updatePage(presentationId, pageId, { name });
    },
    [updatePage]
  );

  const removePage = useCallback((presentationId: string, pageId: string) => {
    setPresentations((current) =>
      current.map((presentation) =>
        presentation.id !== presentationId
          ? presentation
          : {
              ...presentation,
              updatedAt: Date.now(),
              pages: presentation.pages.filter((page) => page.id !== pageId),
            }
      )
    );
  }, []);

  const reorderPage = useCallback((presentationId: string, fromIndex: number, toIndex: number) => {
    setPresentations((current) =>
      current.map((presentation) => {
        if (presentation.id !== presentationId) {
          return presentation;
        }
        const pages = [...presentation.pages];
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= pages.length ||
          toIndex >= pages.length
        ) {
          return presentation;
        }
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        return { ...presentation, pages, updatedAt: Date.now() };
      })
    );
  }, []);

  const getPageValidation = useCallback(
    (page: PresentationPage) => validatePage(page, boardRef.current.children),
    []
  );

  const warnMissingElements = useCallback(
    (page: PresentationPage) => {
      const validation = validatePage(page, boardRef.current.children);
      if (validation.isInvalid) {
        (boardRef.current as DrawnixBoard).showToast?.({
          message: t('presentation.toast.missingElements'),
          description: t('presentation.toast.missingElements.description'),
          type: 'info',
        });
      }
    },
    [t]
  );

  const startPresenting = useCallback(
    (presentationId?: string, pageIndex = 0) => {
      const currentBoard = boardRef.current;
      const targetId = presentationId ?? activePresentationIdRef.current;
      const presentation = presentationsRef.current.find((item) => item.id === targetId);
      if (!presentation || presentation.pages.length === 0) {
        (currentBoard as DrawnixBoard).showToast?.({
          message: t('presentation.toast.empty'),
          description: t('presentation.toast.empty.description'),
          type: 'info',
        });
        return;
      }
      const index = Math.min(Math.max(pageIndex, 0), presentation.pages.length - 1);
      const page = presentation.pages[index];

      // Save the editing viewport/tool so they can be restored on exit.
      restoredViewportRef.current = cloneViewport(currentBoard.viewport);
      restoredPointerRef.current = currentBoard.pointer;

      // Make the board read-only and clear the selection while presenting.
      currentBoard.options.readonly = true;
      Transforms.setSelection(currentBoard, null);
      // The hand tool keeps pan/wheel navigation available despite readonly.
      BoardTransforms.updatePointerType(currentBoard, PlaitPointerType.hand);

      setPresenting({ presentationId: presentation.id, pageIndex: index });
      warnMissingElements(page);
      navigateToPage(currentBoard, page);
    },
    [t, warnMissingElements]
  );

  const stopPresenting = useCallback(() => {
    const currentBoard = boardRef.current;
    const restoredViewport = restoredViewportRef.current;
    const restoredPointer = restoredPointerRef.current;
    currentBoard.options.readonly = false;
    if (restoredPointer) {
      BoardTransforms.updatePointerType(currentBoard, restoredPointer);
    }
    if (restoredViewport) {
      // Restore the exact editing viewport (origination + zoom).
      Transforms.setViewport(currentBoard, {
        ...currentBoard.viewport,
        ...restoredViewport,
        origination: restoredViewport.origination
          ? ([...restoredViewport.origination] as [number, number])
          : undefined,
      });
      restoredViewportRef.current = null;
    }
    restoredPointerRef.current = null;
    setPresenting(null);
  }, []);

  const goToPage = useCallback(
    (nextIndex: number) => {
      const current = presentingRef.current;
      if (!current) {
        return;
      }
      const presentation = presentationsRef.current.find(
        (item) => item.id === current.presentationId
      );
      if (!presentation) {
        return;
      }
      if (
        nextIndex < 0 ||
        nextIndex >= presentation.pages.length ||
        nextIndex === current.pageIndex
      ) {
        return;
      }
      const page = presentation.pages[nextIndex];
      warnMissingElements(page);
      navigateToPage(boardRef.current, page);
      setPresenting({ presentationId: current.presentationId, pageIndex: nextIndex });
    },
    [warnMissingElements]
  );

  const nextPage = useCallback(() => {
    if (presentingRef.current) {
      goToPage(presentingRef.current.pageIndex + 1);
    }
  }, [goToPage]);

  const prevPage = useCallback(() => {
    if (presentingRef.current) {
      goToPage(presentingRef.current.pageIndex - 1);
    }
  }, [goToPage]);

  // Keyboard navigation while presenting.
  useEffect(() => {
    if (!presenting) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        stopPresenting();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        nextPage();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        prevPage();
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        goToPage(0);
        return;
      }
      if (event.key === 'End') {
        const presentation = presentationsRef.current.find(
          (item) => item.id === presenting.presentationId
        );
        if (presentation) {
          event.preventDefault();
          goToPage(presentation.pages.length - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [presenting, goToPage, nextPage, prevPage, stopPresenting]);

  // Restore editing viewport if the board unmounts mid-presentation.
  useEffect(() => {
    return () => {
      if (restoredViewportRef.current) {
        board.options.readonly = false;
        restoredViewportRef.current = null;
        restoredPointerRef.current = null;
      }
    };
  }, [board]);

  const value = useMemo<PresentationContextValue>(
    () => ({
      presentations,
      activePresentationId,
      activePresentation,
      setActivePresentationId,
      replacePresentations,
      addPresentation,
      renamePresentation,
      removePresentation,
      addPage,
      addPageFromSelection,
      updatePage,
      renamePage,
      removePage,
      reorderPage,
      getPageValidation,
      presenting,
      startPresenting,
      stopPresenting,
      nextPage,
      prevPage,
      goToPage,
    }),
    [
      presentations,
      activePresentationId,
      activePresentation,
      replacePresentations,
      addPresentation,
      renamePresentation,
      removePresentation,
      addPage,
      addPageFromSelection,
      updatePage,
      renamePage,
      removePage,
      reorderPage,
      getPageValidation,
      presenting,
      startPresenting,
      stopPresenting,
      nextPage,
      prevPage,
      goToPage,
    ]
  );

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
};

export const usePresentations = (): PresentationContextValue => {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error('usePresentations must be used inside <PresentationProvider>');
  }
  return context;
};
