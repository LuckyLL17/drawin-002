import { PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import { PresentationData } from '../presentation/types';

export interface DrawnixExportedData {
  type: DrawnixExportedType.drawnix;
  version: number;
  source: 'web';
  elements: PlaitElement[];
  viewport: Viewport;
  theme?: PlaitTheme;
  /**
   * Presentation metadata (slides). Optional and additive: older files simply
   * don't have this field and keep loading unchanged.
   */
  presentation?: PresentationData | null;
}

export enum DrawnixExportedType {
  drawnix = 'drawnix',
}
