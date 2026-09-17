import { useEffect, useRef } from 'react';
import classNames from 'classnames';
import { ATTACHED_ELEMENT_CLASS_NAME } from '@plait/core';
import { Island } from '../island';
import {
  PresentationCloseIcon,
  PresentationNextIcon,
  PresentationPrevIcon,
} from '../icons';
import { useI18n } from '../../i18n';
import { useDrawnix } from '../../hooks/use-drawnix';
import { usePresentations } from './presentation-context';

const SWIPE_THRESHOLD = 44;

/**
 * Full-screen playback chrome: keyboard navigation lives in the context
 * provider, this component renders the toolbar and wires touch gestures.
 */
export const PresentationPresenter = () => {
  const { t } = useI18n();
  const { appState } = useDrawnix();
  const { presenting, presentations, nextPage, prevPage, stopPresenting } = usePresentations();

  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Swipe gestures (capture + passive so board pan/pinch is never blocked).
  useEffect(() => {
    if (!presenting) {
      return;
    }
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) {
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const elapsed = Date.now() - start.t;
      if (
        elapsed < 600 &&
        Math.abs(dx) > SWIPE_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * 1.2
      ) {
        if (dx < 0) {
          nextPage();
        } else {
          prevPage();
        }
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart, { capture: true } as any);
      window.removeEventListener('touchend', handleTouchEnd, { capture: true } as any);
    };
  }, [presenting, nextPage, prevPage]);

  if (!presenting) {
    return null;
  }

  const presentation = presentations.find(
    (item) => item.id === presenting.presentationId
  );
  if (!presentation) {
    return null;
  }
  const page = presentation.pages[presenting.pageIndex];
  const total = presentation.pages.length;
  const isFirst = presenting.pageIndex === 0;
  const isLast = presenting.pageIndex === total - 1;

  return (
    <div className={classNames('presentation-presenter', ATTACHED_ELEMENT_CLASS_NAME)}>
      {appState.isMobile && (
        <>
          <button
            type="button"
            aria-label={t('presentation.present')}
            className="presentation-presenter__tap-zone presentation-presenter__tap-zone--prev"
            onClick={() => !isFirst && prevPage()}
            disabled={isFirst}
          />
          <button
            type="button"
            aria-label={t('presentation.present')}
            className="presentation-presenter__tap-zone presentation-presenter__tap-zone--next"
            onClick={() => !isLast && nextPage()}
            disabled={isLast}
          />
        </>
      )}
      <Island padding={1} className="presentation-presenter__toolbar">
        <div className="presentation-presenter__info">
          <span className="presentation-presenter__name" title={presentation.name}>
            {presentation.name}
          </span>
          {page && <span className="presentation-presenter__page-title">{page.name}</span>}
        </div>
        <div className="presentation-presenter__controls">
          <button
            type="button"
            className="presentation-presenter__button"
            onClick={prevPage}
            disabled={isFirst}
            aria-label="Previous page"
            title="←"
          >
            {PresentationPrevIcon}
          </button>
          <span className="presentation-presenter__counter">
            {presenting.pageIndex + 1} / {total}
          </span>
          <button
            type="button"
            className="presentation-presenter__button"
            onClick={nextPage}
            disabled={isLast}
            aria-label="Next page"
            title="→"
          >
            {PresentationNextIcon}
          </button>
          <button
            type="button"
            className="presentation-presenter__button presentation-presenter__button--exit"
            onClick={stopPresenting}
            aria-label={t('presentation.exit')}
            title={t('presentation.exit')}
            data-testid="presentation-exit-button"
          >
            {PresentationCloseIcon}
          </button>
        </div>
      </Island>
    </div>
  );
};
