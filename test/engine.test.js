import { describe, expect, test } from 'vitest';
import { parseBestMoveLine } from '../src/engine.js';

describe('engine parser', () => {
  test('parses basic bestmove line', () => {
    expect(parseBestMoveLine('bestmove e2e4 ponder e7e5')).toEqual({
      from: 'e2',
      to: 'e4',
      promotion: undefined
    });
  });

  test('parses promotion bestmove line', () => {
    expect(parseBestMoveLine('bestmove a7a8q')).toEqual({
      from: 'a7',
      to: 'a8',
      promotion: 'q'
    });
  });
});
