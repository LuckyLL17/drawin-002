import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { getSelectedElements } from '@plait/core';
import { useBoard } from '@plait-board/react-board';
import { Island } from '../island';
import { ToolButton } from '../tool-button';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';
import {
  PresentationAddPageIcon,
  PresentationCaptureIcon,
  PresentationIcon,
  PresentationPlayIcon,
  PresentationWarningIcon,
  TrashIcon,
} from '../icons';
import { useI18n } from '../../i18n';
import { useDrawnix } from '../../hooks/use-drawnix';
import { usePresentations } from './presentation-context';
import type { Presentation, PresentationPage } from './types';
import './presentation.scss';

const PageNameInput = ({ page, presentation }: { page: PresentationPage; presentation: Presentation }) => {
  const { renamePage } = usePresentations();
  const { t } = useI18n();
  const [value, setValue] = useState(page.name);
  const commitRef = useRef(false);

  const commit = () => {
    if (commitRef.current) {
      return;
    }
    commitRef.current = true;
    const nextName = value.trim() || page.name;
    setValue(nextName);
    renamePage(presentation.id, page.id, nextName);
  };

  return (
    <input
      className="presentation-panel__page-name"
      value={value}
      aria-label={t('presentation.page.namePlaceholder')}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          (event.target as HTMLInputElement).blur();
        }
        if (event.key === 'Escape') {
          setValue(page.name);
          (event.target as HTMLInputElement).blur();
        }
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
};

const PageRow = ({
  presentation,
  page,
  index,
}: {
  presentation: Presentation;
  page: PresentationPage;
  index: number;
}) => {
  const { t } = useI18n();
  const { removePage, reorderPage, startPresenting, getPageValidation } = usePresentations();
  const validation = getPageValidation(page);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={classNames('presentation-panel__page', {
        'presentation-panel__page--invalid': validation.isInvalid,
        'presentation-panel__page--dragover': dragOver,
      })}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/x-presentation-page-index', String(index));
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const fromIndex = Number(
          event.dataTransfer.getData('text/x-presentation-page-index')
        );
        if (Number.isInteger(fromIndex)) {
          reorderPage(presentation.id, fromIndex, index);
        }
      }}
      onClick={() => startPresenting(presentation.id, index)}
      title={t('presentation.page.playFromHere')}
    >
      <span className="presentation-panel__page-index">{index + 1}</span>
      <div className="presentation-panel__page-main">
        <PageNameInput page={page} presentation={presentation} />
        {validation.isInvalid && (
          <span
            className="presentation-panel__page-warning"
            title={t('presentation.page.invalid')}
          >
            {PresentationWarningIcon}
          </span>
        )}
      </div>
      <ToolButton
        type="icon"
        className="presentation-panel__page-delete"
        icon={TrashIcon}
        visible={true}
        title={t('presentation.page.delete')}
        aria-label={t('presentation.page.delete')}
        onPointerUp={() => removePage(presentation.id, page.id)}
      />
    </div>
  );
};

export const PresentationPanel = () => {
  const board = useBoard();
  const { t } = useI18n();
  const { appState, showToast } = useDrawnix();
  const {
    presentations,
    activePresentation,
    activePresentationId,
    setActivePresentationId,
    addPage,
    addPageFromSelection,
    renamePresentation,
    removePresentation,
    startPresenting,
    presenting,
  } = usePresentations();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [presentationName, setPresentationName] = useState('');

  const selectedElements = getSelectedElements(board);

  const pageCount = activePresentation?.pages.length ?? 0;

  // Close the editor panel when a presentation starts.
  useEffect(() => {
    if (presenting !== null) {
      setOpen(false);
    }
  }, [presenting]);

  const presentationOptions = useMemo(
    () => presentations.map((presentation) => presentation.id),
    [presentations]
  );

  const startRename = () => {
    if (activePresentation) {
      setPresentationName(activePresentation.name);
      setRenaming(true);
    }
  };

  const commitRename = () => {
    if (activePresentation) {
      const nextName = presentationName.trim() || activePresentation.name;
      renamePresentation(activePresentation.id, nextName);
    }
    setRenaming(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      sideOffset={10}
    >
      <PopoverTrigger asChild>
        <Island padding={1} className="presentation-panel-trigger">
          <ToolButton
            type="icon"
            icon={PresentationIcon}
            visible={true}
            selected={open}
            title={t('presentation.menu.open')}
            aria-label={t('presentation.menu.open')}
            data-testid="presentation-panel-button"
            onPointerDown={() => {
              setOpen((value) => !value);
            }}
          />
        </Island>
      </PopoverTrigger>
      <PopoverContent className="presentation-panel__popover">
        <div className="presentation-panel" data-testid="presentation-panel">
          <div className="presentation-panel__header">
            {renaming && activePresentation ? (
              <input
                className="presentation-panel__presentation-name-input"
                value={presentationName}
                autoFocus
                onChange={(event) => setPresentationName(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitRename();
                  }
                  if (event.key === 'Escape') {
                    setRenaming(false);
                  }
                }}
              />
            ) : presentations.length > 0 ? (
              <select
                className="presentation-panel__presentation-select"
                value={activePresentationId ?? ''}
                aria-label={t('presentation.title')}
                onChange={(event) => setActivePresentationId(event.target.value)}
              >
                {presentationOptions.map((id) => {
                  const presentation = presentations.find((item) => item.id === id);
                  if (!presentation) {
                    return null;
                  }
                  return (
                    <option key={id} value={id}>
                      {presentation.name} ({presentation.pages.length})
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="presentation-panel__title">{t('presentation.title')}</span>
            )}
            {activePresentation && (
              <div className="presentation-panel__header-actions">
                <ToolButton
                  type="button"
                  label="✎"
                  visible={true}
                  title={t('presentation.renamePresentation')}
                  aria-label={t('presentation.renamePresentation')}
                  onClick={startRename}
                />
                <ToolButton
                  type="icon"
                  icon={TrashIcon}
                  visible={true}
                  title={t('presentation.deletePresentation')}
                  aria-label={t('presentation.deletePresentation')}
                  onClick={() => activePresentation && removePresentation(activePresentation.id)}
                />
              </div>
            )}
          </div>

          <div className="presentation-panel__pages">
            {activePresentation && activePresentation.pages.length > 0 ? (
              activePresentation.pages.map((page, index) => (
                <PageRow
                  key={page.id}
                  presentation={activePresentation}
                  page={page}
                  index={index}
                />
              ))
            ) : (
              <div className="presentation-panel__empty">
                {PresentationIcon}
                <p className="presentation-panel__empty-title">{t('presentation.empty')}</p>
                <p className="presentation-panel__empty-hint">{t('presentation.empty.hint')}</p>
              </div>
            )}
          </div>

          <div className="presentation-panel__footer">
            <button
              type="button"
              className="presentation-panel__footer-button"
              onClick={() => {
                const id = addPage(undefined, t('presentation.defaultName'));
                if (id) {
                  showToast({ message: t('presentation.toast.captured') });
                }
              }}
              title={t('presentation.capture')}
            >
              {PresentationAddPageIcon}
              <span>{t('presentation.capture')}</span>
            </button>
            <button
              type="button"
              className={classNames('presentation-panel__footer-button', {
                'presentation-panel__footer-button--disabled': selectedElements.length === 0,
              })}
              disabled={selectedElements.length === 0}
              onClick={() => {
                addPageFromSelection(undefined, t('presentation.defaultName'));
              }}
              title={t('presentation.captureFromSelection')}
            >
              {PresentationCaptureIcon}
              <span>{t('presentation.captureFromSelection')}</span>
            </button>
            <button
              type="button"
              className="presentation-panel__play"
              disabled={pageCount === 0}
              data-testid="presentation-start-button"
              onClick={() => {
                setOpen(false);
                startPresenting();
              }}
            >
              {PresentationPlayIcon}
              <span>{t('presentation.start')}</span>
            </button>
          </div>
          {!appState.isMobile && activePresentation && (
            <div className="presentation-panel__hint">
              {pageCount} {t('presentation.pageCount')}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
