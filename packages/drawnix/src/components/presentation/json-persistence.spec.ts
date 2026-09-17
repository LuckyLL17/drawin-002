import { describe, expect, it } from 'vitest';
import {
  createPresentation,
  createPresentationPage,
  sanitizePresentations,
} from './types';

describe('presentation json persistence contract', () => {
  it('serializes through serializeAsJSON when presentations exist on the board', async () => {
    const page = createPresentationPage([10, 20], 1.25, 'Intro', ['el-1']);
    const presentation = createPresentation('Deck', [page]);
    const board = {
      children: [{ id: 'el-1' }],
      viewport: { zoom: 1 },
      theme: { themeColorMode: 'default' },
      presentations: [presentation],
    } as any;
    const mod = await import('../../data/json');
    const json = JSON.parse(mod.serializeAsJSON(board));
    expect(json.type).toBe('drawnix');
    expect(json.presentations).toHaveLength(1);
    expect(json.presentations[0].pages[0].name).toBe('Intro');
    expect(json.presentations[0].pages[0].elementIds).toEqual(['el-1']);
  });

  it('omits the presentations key for old-style boards without metadata', async () => {
    const board = {
      children: [],
      viewport: { zoom: 1 },
      theme: { themeColorMode: 'default' },
    } as any;
    const mod = await import('../../data/json');
    const json = JSON.parse(mod.serializeAsJSON(board));
    expect(json).not.toHaveProperty('presentations');
    expect(mod.isValidDrawnixData(json)).toBe(true);
  });

  it('still accepts legacy files without presentations', () => {
    const legacy = {
      type: 'drawnix',
      version: 1,
      source: 'web',
      elements: [],
      viewport: { zoom: 1 },
    };
    expect(sanitizePresentations((legacy as any).presentations)).toEqual([]);
  });
});
