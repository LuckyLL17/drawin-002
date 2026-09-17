import { useEffect, useState } from 'react';
import { ATTACHED_ELEMENT_CLASS_NAME } from '@plait/core';
import { isHotkey } from 'is-hotkey';
import { useI18n } from '../../i18n';
import { useDrawnix } from '../../hooks/use-drawnix';
import { Island } from '../../components/island';
import { ToolButton } from '../../components/tool-button';
import { PresentationPlayIcon } from '../../components/icons';
import { usePresentation } from '../presentation-context';
import { useStaleSlideReconciler } from '../use-stale-slide-reconciler';
import { PresentationPanel } from './presentation-panel';
import { Presenter } from './presenter';

/**
 * Top-level presentation surface: the management panel plus the full-screen
 * presenter. A compact floating button gives mobile users an entry point
 * because the management island is hidden on small screens.
 */
export const PresentationMode: React.FC = () => {
  const { t } = useI18n();
  const { showToast } = useDrawnix();
  const { presentation, pruneStale } = usePresentation();
  const [presentingIndex, setPresentingIndex] = useState<number | null>(null);

  // Ranges referencing deleted elements are cleaned up automatically; toast
  // only when the user is back in editing mode so playback isn't interrupted.
  useStaleSlideReconciler((staleSlideIds) => {
    if (presentingIndex === null && staleSlideIds.length) {
      showToast({ message: t('presentation.staleRange') });
    }
  });

  const start = (index = 0) => {
    if (!presentation.slides.length) {
      return;
    }
    const { staleSlideIds } = pruneStale();
    if (staleSlideIds.length) {
      showToast({ message: t('presentation.staleRange') });
    }
    setPresentingIndex(Math.max(0, Math.min(index, presentation.slides.length - 1)));
  };

  // Cmd/Ctrl+Enter starts playback without opening the management panel.
  useEffect(() => {
    if (presentingIndex !== null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTyping) {
        return;
      }
      if (isHotkey('mod+enter')(event) && presentation.slides.length > 0) {
        event.preventDefault();
        start(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentingIndex, presentation.slides.length]);

  return (
    <>
      <PresentationPanel onStart={(index) => start(index)} />
      {presentation.slides.length > 0 && presentingIndex === null && (
        <Island padding={1} className={`presentation-mobile-entry ${ATTACHED_ELEMENT_CLASS_NAME}`}>
          <ToolButton
            type="icon"
            icon={PresentationPlayIcon}
            visible={true}
            title={t('presentation.start')}
            aria-label={t('presentation.start')}
            onPointerUp={() => start(0)}
          />
        </Island>
      )}
      {presentingIndex !== null && (
        <Presenter startIndex={presentingIndex} onExit={() => setPresentingIndex(null)} />
      )}
    </>
  );
};
