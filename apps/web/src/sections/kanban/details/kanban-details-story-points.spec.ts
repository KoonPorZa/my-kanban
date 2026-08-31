import { it, expect, describe } from 'vitest';

import { parseStoryPoints } from './kanban-details';

describe('parseStoryPoints', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['0', 0],
    ['8', 8],
    ['100', 100],
  ])('parses %j as %j', (input, expected) => {
    expect(parseStoryPoints(input)).toEqual({ error: null, value: expected });
  });

  it.each(['-1', '1.5', 'abc', '101'])('rejects invalid value %j', (input) => {
    expect(parseStoryPoints(input)).toEqual({
      error: 'Enter a whole number from 0 to 100.',
      value: null,
    });
  });
});
