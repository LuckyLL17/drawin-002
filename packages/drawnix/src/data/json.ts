import { PlaitBoard } from '@plait/core';
import { MIME_TYPES, VERSIONS } from '../constants';
import { fileOpen, fileSave, type FileSystemHandle } from './filesystem';
import { DrawnixExportedData, DrawnixExportedType } from './types';
import { loadFromBlob, normalizeFile } from './blob';
import { getBoardPresentation, setBoardPresentation } from '../presentation/presentation-context';
import { isPresentationData, pruneStaleSlides, PresentationData } from '../presentation/types';

export type DrawnixFileHandle = FileSystemHandle | null;

type FileWithHandle = File & {
  handle?: FileSystemHandle;
};

export const getDefaultName = () => {
  const time = new Date().getTime();
  return time.toString();
};

export const saveAsJSON = async (board: PlaitBoard, name: string = getDefaultName()) => {
  return saveJSON(board, null, name);
};

export const saveJSON = async (
  board: PlaitBoard,
  existingFileHandle: DrawnixFileHandle = null,
  name: string = getDefaultName()
) => {
  const serialized = serializeAsJSON(board);
  const blob = new Blob([serialized], {
    type: MIME_TYPES.drawnix,
  });

  const fileHandle = await fileSave(blob, {
    name,
    extension: 'drawnix',
    description: 'Drawnix file',
    fileHandle: existingFileHandle,
  });
  return { fileHandle };
};

export const loadFromJSON = async (board: PlaitBoard) => {
  const file = await fileOpen({
    description: 'Drawnix files',
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.drawnix` files.
    // extensions: ["json", "drawnix", "png", "svg"],
  });
  const fileHandle = (file as FileWithHandle).handle || null;
  const data = await loadFromBlob(board, await normalizeFile(file));
  return { data, fileHandle };
};

export const isValidDrawnixData = (data?: any): data is DrawnixExportedData => {
  return (
    data &&
    data.type === DrawnixExportedType.drawnix &&
    Array.isArray(data.elements) &&
    typeof data.viewport === 'object'
  );
};

/**
 * Read presentation metadata out of parsed file data. Unknown / malformed
 * payloads resolve to `null` so legacy or third-party files keep working.
 */
export const readPresentationFromData = (data: unknown): PresentationData | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const presentation = (data as { presentation?: unknown }).presentation;
  if (!isPresentationData(presentation)) {
    return null;
  }
  return presentation;
};

/**
 * Apply presentation metadata loaded from a file to the board. Element ranges
 * are pruned against the loaded elements so deleted elements can never leave
 * dangling references. Returns the (possibly pruned) data for syncing React
 * state.
 */
export const applyLoadedPresentation = (
  board: PlaitBoard,
  data: DrawnixExportedData
): PresentationData | null => {
  const presentation = readPresentationFromData(data);
  if (!presentation) {
    setBoardPresentation(board, null);
    return null;
  }
  const { presentation: pruned } = pruneStaleSlides(presentation, data.elements);
  setBoardPresentation(board, pruned);
  return pruned.slides.length ? pruned : null;
};

export const serializeAsJSON = (board: PlaitBoard): string => {
  const presentation = getBoardPresentation(board);
  const data: DrawnixExportedData = {
    type: DrawnixExportedType.drawnix,
    version: VERSIONS.drawnix,
    source: 'web',
    elements: board.children,
    viewport: board.viewport,
    theme: board.theme,
  };
  // Omit the field entirely when there are no slides: the output stays
  // byte-compatible with older versions of the app.
  if (presentation && presentation.slides.length > 0) {
    data.presentation = presentation;
  }

  return JSON.stringify(data, null, 2);
};
