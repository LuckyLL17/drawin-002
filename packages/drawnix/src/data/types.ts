import { PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import { Presentation } from '../components/presentation/types';

export interface DrawnixExportedData {
  type: DrawnixExportedType.drawnix;
  version: number;
  source: 'web';
  elements: PlaitElement[];
  viewport: Viewport;
  theme?: PlaitTheme;
  /**
   * Presentation pages metadata. Optional so files written by older versions
   * keep loading without changes.
   */
  presentations?: Presentation[];
}

export enum DrawnixExportedType {
  drawnix = 'drawnix',
}
