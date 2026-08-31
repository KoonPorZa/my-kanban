import { describe, expect, it } from 'vitest';

import { DomainValidationError } from './domain-errors';
import { rankForPosition, rebalancedRanks } from './rank';

describe('rank allocation', () => {
  const siblings = [
    { id: 'a', rank: 1024n },
    { id: 'b', rank: 2048n },
    { id: 'c', rank: 3072n },
  ];

  it('allocates a midpoint between adjacent records', () => {
    expect(rankForPosition(siblings, 'b', 'a')).toBe(1536n);
  });

  it('appends after the last record when no neighbors are supplied', () => {
    expect(rankForPosition(siblings)).toBe(4096n);
  });

  it('requests a rebalance when no integer midpoint exists', () => {
    expect(
      rankForPosition(
        [
          { id: 'a', rank: 1n },
          { id: 'b', rank: 2n },
        ],
        'b',
        'a'
      )
    ).toBeNull();
  });

  it('rejects neighbors that are not adjacent', () => {
    expect(() => rankForPosition(siblings, 'c', 'a')).toThrow(DomainValidationError);
  });

  it('rebalances records with a stable gap', () => {
    expect(rebalancedRanks([...siblings].reverse())).toEqual([
      { id: 'a', rank: 1024n },
      { id: 'b', rank: 2048n },
      { id: 'c', rank: 3072n },
    ]);
  });
});
