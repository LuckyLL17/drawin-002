import { ATTACHED_ELEMENT_CLASS_NAME, PlaitBoard, getSelectedElements } from '@plait/core';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { useBoard } from '@plait-board/react-board';
import { Island } from '../../components/island';
import { ToolButton } from '../../components/tool-button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/popover/popover';
import {
  PresentationAddIcon,
  PresentationCaptureIcon,
  PresentationChevronDownIcon,
  PresentationChevronUpIcon,
  PresentationPlayIcon,
  PresentationSlidesIcon,
  TrashIcon,
} from '../../components/icons';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { PresentationSlide, canMoveSlide } from '../types';
import { applySlideViewport, captureCurrentViewport } from '../viewport';
import { usePresentation } from '../presentation-context';
import './presentation-toolbar.scss';

export interface PresentationPanelProps {
  onStart: (startIndex: number) => void;
}

const SlideRow = ({
  slide,
  index,
  onStart,
}: {
  slide: PresentationSlide;
  index: number;
  onStart: () => void;
}) => {
  const board = useBoard();
  const { t } = useI18n();
  const { presentation, updateSlide, removeSlide, reorderSlide } = usePresentation();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(slide.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(slide.name);
  }, [slide.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitName = () => {
    const name = draftName.trim();
    if (name !== slide.name) {
      updateSlide(slide.id, { name });
    }
    setDraftName(name);
    setIsEditing(false);
  };

  const displayName = slide.name || `${t('presentation.untitledSlide')} ${index + 1}`;

  return (
    <li
      className={classNames('presentation-slide-row', {
        'presentation-slide-row--range': !!slide.elementIds?.length,
      })}
    >
      <button
        type="button"
        className="presentation-slide-row__preview"
        title={displayName}
        onClick={() => applySlideViewport(board, slide)}
        onDoubleClick={() => {
          applySlideViewport(board, slide);
          onStart();
        }}
      >
        <span className="presentation-slide-row__index">{index + 1}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            className="presentation-slide-row__name-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitName();
              }
              if (event.key === 'Escape') {
                setDraftName(slide.name);
                setIsEditing(false);
              }
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={t('presentation.rename')}
          />
        ) : (
          <span
            className="presentation-slide-row__name"
            onDoubleClick={(event) => {
              event.stopPropagation();
              setIsEditing(true);
            }}
          >
            {displayName}
          </span>
        )}
      </button>
      <span className="presentation-slide-row__actions">
        <ToolButton
          type="icon"
          icon={PresentationChevronUpIcon}
          visible={true}
          size="small"
          title={t('presentation.moveUp')}
          aria-label={t('presentation.moveUp')}
          disabled={!canMoveSlide(presentation, slide.id, 'up')}
          onPointerUp={() => reorderSlide(slide.id, 'up')}
        />
        <ToolButton
          type="icon"
          icon={PresentationChevronDownIcon}
          visible={true}
          size="small"
          title={t('presentation.moveDown')}
          aria-label={t('presentation.moveDown')}
          disabled={!canMoveSlide(presentation, slide.id, 'down')}
          onPointerUp={() => reorderSlide(slide.id, 'down')}
        />
        <ToolButton
          type="icon"
          icon={PresentationCaptureIcon}
          visible={true}
          size="small"
          title={t('presentation.captureCurrent')}
          aria-label={t('presentation.captureCurrent')}
          onPointerUp={() => {
            updateSlide(slide.id, { ...captureCurrentViewport(board) });
          }}
        />
        <ToolButton
          type="icon"
          icon={PresentationPlayIcon}
          visible={true}
          size="small"
          title={t('presentation.start')}
          aria-label={t('presentation.start')}
          onPointerUp={onStart}
        />
        <ToolButton
          type="icon"
          icon={TrashIcon}
          visible={true}
          size="small"
          title={t('presentation.delete')}
          aria-label={t('presentation.delete')}
          onPointerUp={() => removeSlide(slide.id)}
        />
      </span>
    </li>
  );
};

export const PresentationPanel: React.FC<PresentationPanelProps> = ({ onStart }) => {
  const board = useBoard();
  const { t } = useI18n();
  const { showToast } = useDrawnix();
  const container = PlaitBoard.getBoardContainer(board);
  const { presentation, addSlide, addSlideFromSelection, pruneStale } = usePresentation();
  const [open, setOpen] = useState(false);

  // Elements referenced by slides can be deleted outside the panel; prune the
  // stored ranges every time the panel is opened so playback never targets
  // ghosts.
  useEffect(() => {
    if (open && presentation.slides.some((slide) => slide.elementIds?.length)) {
      const { staleSlideIds } = pruneStale();
      if (staleSlideIds.length) {
        showToast({ message: t('presentation.staleRange') });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startPresentation = (index = 0) => {
    if (!presentation.slides.length) {
      return;
    }
    const { staleSlideIds } = pruneStale();
    if (staleSlideIds.length) {
      showToast({ message: t('presentation.staleRange') });
    }
    onStart(Math.max(0, Math.min(index, presentation.slides.length - 1)));
    setOpen(false);
  };

  return (
    <Island padding={1} className={classNames('presentation-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}>
      <Popover sideOffset={12} open={open} onOpenChange={setOpen} placement="bottom-start">
        <PopoverTrigger asChild>
          <ToolButton
            type="icon"
            visible={true}
            selected={open}
            icon={PresentationSlidesIcon}
            title={t('presentation.toolbar')}
            aria-label={t('presentation.toolbar')}
            onPointerDown={() => setOpen(!open)}
          />
        </PopoverTrigger>
        <PopoverContent container={container} className="presentation-panel">
          <div className="presentation-panel__header">
            <span className="presentation-panel__title">{t('presentation.toolbar')}</span>
            <div className="presentation-panel__header-actions">
              <ToolButton
                type="icon"
                icon={PresentationAddIcon}
                visible={true}
                size="small"
                title={t('presentation.addSlide')}
                aria-label={t('presentation.addSlide')}
                onPointerUp={() => {
                  addSlide();
                  showToast({ message: t('presentation.addedSlide') });
                }}
              />
              <ToolButton
                type="icon"
                icon={PresentationCaptureIcon}
                visible={true}
                size="small"
                title={t('presentation.addSlideFromSelection')}
                aria-label={t('presentation.addSlideFromSelection')}
                disabled={getSelectedElements(board).length === 0}
                onPointerUp={() => {
                  const slide = addSlideFromSelection();
                  showToast({
                    message: slide ? t('presentation.addedSlide') : t('presentation.noSelection'),
                  });
                }}
              />
              <ToolButton
                type="icon"
                icon={PresentationPlayIcon}
                visible={true}
                size="small"
                title={t('presentation.start')}
                aria-label={t('presentation.start')}
                disabled={presentation.slides.length === 0}
                onPointerUp={() => startPresentation(0)}
              />
            </div>
          </div>
          {presentation.slides.length === 0 ? (
            <div className="presentation-panel__empty">
              <div className="presentation-panel__empty-title">{t('presentation.empty.title')}</div>
              <div className="presentation-panel__empty-description">
                {t('presentation.empty.description')}
              </div>
            </div>
          ) : (
            <ul className="presentation-panel__list">
              {presentation.slides.map((slide, index) => (
                <SlideRow
                  key={slide.id}
                  slide={slide}
                  index={index}
                  onStart={() => startPresentation(index)}
                />
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </Island>
  );
};
