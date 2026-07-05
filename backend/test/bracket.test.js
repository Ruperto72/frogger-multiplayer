const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateBracket, findNextMatch, reportWinner, champion } = require('../bracket');

function allIdsInRound0(rounds) {
  return rounds[0].flatMap(m => [m.p1, m.p2]).filter(id => id !== null);
}

test('2 deltagare ger en enda match utan frilotter', () => {
  const rounds = generateBracket([1, 2]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].length, 1);
  assert.deepEqual(allIdsInRound0(rounds).sort(), [1, 2]);
});

test('16 deltagare ger 4 omgångar och 15 matcher', () => {
  const ids = Array.from({ length: 16 }, (_, i) => i + 1);
  const rounds = generateBracket(ids);
  assert.deepEqual(rounds.map(r => r.length), [8, 4, 2, 1]);
  assert.equal(allIdsInRound0(rounds).length, 16);
});

test('6 deltagare ger 8-träd med 2 frilotter som avgörs direkt', () => {
  const rounds = generateBracket([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(rounds.map(r => r.length), [4, 2, 1]);
  const byes = rounds[0].filter(m => m.p2 === null);
  assert.equal(byes.length, 2);
  for (const m of byes) {
    assert.equal(m.winner, m.p1);         // frilott avgjord vid generering
    assert.notEqual(m.p1, null);          // aldrig två null i samma match
  }
  assert.equal(allIdsInRound0(rounds).length, 6);
});

test('alla deltagare förekommer exakt en gång i omgång 0', () => {
  const ids = [10, 20, 30, 40, 50];
  const rounds = generateBracket(ids);
  assert.deepEqual(allIdsInRound0(rounds).sort((a, b) => a - b), ids);
});

test('findNextMatch tar omgång 0 före omgång 1 och hoppar över frilotter', () => {
  const rounds = generateBracket([1, 2, 3]); // 4-träd, 1 frilott
  const next = findNextMatch(rounds);
  assert.equal(next.round, 0);
  assert.equal(rounds[0][next.index].p2 !== null, true);
});

test('reportWinner propagerar vinnaren till rätt slot i nästa omgång', () => {
  const rounds = generateBracket([1, 2, 3, 4]);
  reportWinner(rounds, 0, 0, rounds[0][0].p1);
  assert.equal(rounds[1][0].p1, rounds[0][0].p1);
  reportWinner(rounds, 0, 1, rounds[0][1].p2, true);
  assert.equal(rounds[1][0].p2, rounds[0][1].p2);
  assert.equal(rounds[0][1].walkover, true);
});

test('champion är null tills finalen är avgjord', () => {
  const rounds = generateBracket([1, 2]);
  assert.equal(champion(rounds), null);
  reportWinner(rounds, 0, 0, rounds[0][0].p1);
  assert.equal(champion(rounds), rounds[0][0].p1);
  assert.equal(findNextMatch(rounds), null);
});

test('hela turneringen kan spelas klart via findNextMatch/reportWinner', () => {
  const rounds = generateBracket([1, 2, 3, 4, 5, 6, 7]); // 8-träd, 1 frilott
  let guard = 0;
  let m;
  while ((m = findNextMatch(rounds)) !== null) {
    assert.ok(++guard < 20, 'oändlig loop');
    reportWinner(rounds, m.round, m.index, rounds[m.round][m.index].p1);
  }
  assert.notEqual(champion(rounds), null);
});
