import {
  BoardTransforms,
  PlaitBoard,
  PlaitPointerType,
  Viewport,
  ATTACHED_ELEMENT_CLASS_NAME,
} from '@plait/core';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from '@plait-board/react-board';
import { ToolButton } from '../../components/tool-button';
import {
  PresentationCloseIcon,
  PresentationNextIcon,
  PresentationPrevIcon,
} from '../../components/icons';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { applySlideViewport } from '../viewport';
import { clearHighlightedElements, highlightSlideElements } from '../highlight';
import { usePresentation } from '../presentation-context';
import './presenter.scss';

export interface PresenterProps {
  startIndex?: number;
  onExit?: () => void;
}

interface PlaybackSnapshot {
  viewport: Viewport;
  pointer: string;
}

const SWIPE_THRESHOLD = 40;

/**
 * Full-screen playback surface. Mounting it snapshots the editing viewport and
 * switches the board to a neutral read-only tool; unmounting restores both so
 * the editor is returned to the exact state the presenter left it in.
 */
export const Presenter: React.FC<PresenterProps> = ({ startIndex = 0, onExit }) => {
  const board = useBoard() as PlaitBoard & { appState?: { toolState?: { pointer: string } } };
  const { t } = useI18n();
  const { setAppState } = useDrawnix();
  const { presentation } = usePresentation();
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(startIndex, Math.max(presentation.slides.length - 1, 0)))
  );

  const snapshotRef = useRef<PlaybackSnapshot | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // --- enter / leave playback ------------------------------------------------
  useEffect(() => {
    snapshotRef.current = {
      viewport: {
        zoom: board.viewport.zoom,
        origination: board.viewport.origination ? [...board.viewport.origination] : undefined,
      },
      pointer: board.appState?.toolState?.pointer ?? PlaitPointerType.hand,
    };
    BoardTransforms.updatePointerType(board, PlaitPointerType.hand);
    setAppState((state) => ({
      ...state,
      toolState: { ...state.toolState, pointer: PlaitPointerType.hand },
    }));
    const container = PlaitBoard.getBoardContainer(board);
    container.classList.add('presentation-playing');

    return () => {
      container.classList.remove('presentation-playing');
      clearHighlightedElements(board);
      const snapshot = snapshotRef.current;
      if (snapshot) {
        // Only restore when we captured a real viewport; boards without an
        // origination (empty initial state) are left where the last slide was.
        if (snapshot.viewport.origination) {
          BoardTransforms.updateViewport(
            board,
            snapshot.viewport.origination as [number, number],
            snapshot.viewport.zoom
          );
        }
        const pointer = snapshot.pointer as PlaitPointerType;
        BoardTransforms.updatePointerType(board, pointer);
        setAppState((state) => ({
          ...state,
          toolState: { ...state.toolState, pointer },
        }));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // --- apply the current slide ----------------------------------------------
  useEffect(() => {
    const slides = presentation.slides;
    if (!slides.length) {
      return;
    }
    const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[safeIndex];
    if (!slide) {
      return;
    }
    applySlideViewport(board, slide);
    highlightSlideElements(board, slide);
  }, [board, presentation.slides, index]);

  const total = presentation.slides.length;
  const go = useCallback(
    (nextIndex: number) => {
      if (!total) {
        return;
      }
      setIndex(Math.max(0, Math.min(nextIndex, total - 1)));
    },
    [total]
  );
  const goPrev = useCallback(() => go(index - 1), [go, index]);
  const goNext = useCallback(() => go(index + 1), [go, index]);
  const exit = useCallback(() => onExit?.(), [onExit]);

  const isLast = index >= total - 1;
  const isFirst = index <= 0;

  // --- keyboard navigation ---------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTyping) {
        return;
      }
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          goPrev();
          break;
        case 'Home':
          event.preventDefault();
          go(0);
          break;
        case 'End':
          event.preventDefault();
          go(total - 1);
          break;
        case 'Escape':
          event.preventDefault();
          exit();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [goNext, goPrev, go, exit, total]);

  // --- keep the index inside bounds when the slide list shrinks --------------
  useEffect(() => {
    if (index > presentation.slides.length - 1) {
      setIndex(Math.max(0, presentation.slides.length - 1));
    }
  }, [presentation.slides.length, index]);

  // --- leave playback if the deck disappeared (e.g. every slide deleted) -----
  useEffect(() => {
    if (presentation.slides.length === 0) {
      onExit?.();
    }
  }, [presentation.slides.length, onExit]);

  const indicator = useMemo(
    () =>
      t('presentation.pageIndicator')
        .replace('{current}', String(Math.min(index + 1, total || 1)))
        .replace('{total}', String(total)),
    [t, index, total]
  );

  if (!total) {
    return null;
  }

  return (
    <div
      className={classNames('presenter', ATTACHED_ELEMENT_CLASS_NAME)}
      role="dialog"
      aria-modal="true"
      aria-label={t('presentation.start')}
      onTouchStart={(event) => {
        touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current;
        touchStartXRef.current = null;
        if (startX === null) {
          return;
        }
        const endX = event.changedTouches[0]?.clientX ?? startX;
        const deltaX = endX - startX;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
          if (deltaX < 0) {
            goNext();
          } else {
            goPrev();
          }
        }
      }}
    >
      <div className="presenter__topbar">
        <span className="presenter__title">
          {presentation.slides[index]?.name || `${t('presentation.slide')} ${index + 1}`}
        </span>
        <ToolButton
          type="icon"
          icon={PresentationCloseIcon}
          visible={true}
          title={t('presentation.exit')}
          aria-label={t('presentation.exit')}
          onPointerUp={exit}
        />
      </div>

      {/* invisible click zones for tap navigation on touch devices */}
      <button
        type="button"
        aria-label={t('presentation.prev')}
        className="presenter__tap-zone presenter__tap-zone--prev"
        onClick={goPrev}
        disabled={isFirst}
      />
      <button
        type="button"
        aria-label={t('presentation.next')}
        className="presenter__tap-zone presenter__tap-zone--next"
        onClick={goNext}
        disabled={isLast}
      />

      <div className="presenter__bottombar">
        <ToolButton
          type="icon"
          icon={PresentationPrevIcon}
          visible={true}
          title={t('presentation.prev')}
          aria-label={t('presentation.prev')}
          onPointerUp={goPrev}
          disabled={isFirst}
        />
        <span className="presenter__indicator" aria-live="polite">
          {indicator}
          {isLast && <span className="presenter__end-hint">{t('presentation.end')}</span>}
        </span>
        <ToolButton
          type="icon"
          icon={PresentationNextIcon}
          visible={true}
          title={t('presentation.next')}
          aria-label={t('presentation.next')}
          onPointerUp={goNext}
          disabled={isLast}
        />
      </div>
    </div>
  );
};
