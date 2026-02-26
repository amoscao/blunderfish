// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';
import { createBoard } from '../src/board.js';

function makeBoard() {
  const container = document.createElement('div');
  const board = createBoard({
    container,
    onHumanMoveAttempt: vi.fn()
  });
  return { board, container };
}

describe('board blind marker rendering', () => {
  test('renders marker only on selected occupied squares when visible', () => {
    const { board, container } = makeBoard();

    board.setBlindMarkers({ squares: ['e4', 'a1'], visible: true });
    board.render({ e4: { color: 'w', type: 'p' } }, 'w');

    expect(container.querySelectorAll('.blind-marker')).toHaveLength(1);
    expect(container.querySelector('[data-square="e4"] .blind-marker')).not.toBeNull();
    expect(container.querySelector('[data-square="a1"] .blind-marker')).toBeNull();
  });

  test('does not render markers when hidden', () => {
    const { board, container } = makeBoard();

    board.setBlindMarkers({ squares: ['e4'], visible: false });
    board.render({ e4: { color: 'w', type: 'p' } }, 'w');

    expect(container.querySelectorAll('.blind-marker')).toHaveLength(0);
  });

  test('updates marker set across re-renders', () => {
    const { board, container } = makeBoard();

    board.setBlindMarkers({ squares: ['e4'], visible: true });
    board.render({ e4: { color: 'w', type: 'p' }, d4: { color: 'b', type: 'p' } }, 'w');
    expect(container.querySelector('[data-square="e4"] .blind-marker')).not.toBeNull();

    board.setBlindMarkers({ squares: ['d4'], visible: true });
    board.render({ e4: { color: 'w', type: 'p' }, d4: { color: 'b', type: 'p' } }, 'w');

    expect(container.querySelector('[data-square="e4"] .blind-marker')).toBeNull();
    expect(container.querySelector('[data-square="d4"] .blind-marker')).not.toBeNull();
  });
});
