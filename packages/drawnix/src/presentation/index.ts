export * from './types';
export * from './viewport';
export * from './highlight';
export {
  BOARD_PRESENTATION_KEY,
  PresentationProvider,
  usePresentation,
  usePresentationBoard,
  getBoardPresentation,
  setBoardPresentation,
} from './presentation-context';
export type { PresentationContextValue, PresentationProviderProps } from './presentation-context';
export { PresentationPanel } from './components/presentation-panel';
export { PresentationMode } from './components/presentation-mode';
export { Presenter } from './components/presenter';
export { useStaleSlideReconciler } from './use-stale-slide-reconciler';
