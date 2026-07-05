// Ren utslagsträdslogik. bracket = rounds[roundIndex][matchIndex],
// match = { p1, p2, winner, walkover } med deltagar-id eller null.

function bracketSize(n) {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

// Blandar ids med rand() (0..1) och bygger trädet. Antalet frilotter är
// alltid < size/2, så varje frilott får en egen match (p2 = null) och
// avgörs direkt vid genereringen.
function generateBracket(ids, rand = Math.random) {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const size = bracketSize(shuffled.length);
  const byes = size - shuffled.length;
  const firstRound = [];
  let k = 0;
  for (let m = 0; m < size / 2; m++) {
    const p1 = shuffled[k++];
    const p2 = m < byes ? null : shuffled[k++];
    firstRound.push({ p1, p2, winner: null, walkover: false });
  }
  const rounds = [firstRound];
  for (let len = size / 4; len >= 1; len /= 2) {
    rounds.push(Array.from({ length: len },
      () => ({ p1: null, p2: null, winner: null, walkover: false })));
  }
  for (let i = 0; i < firstRound.length; i++) {
    if (firstRound[i].p2 === null) reportWinner(rounds, 0, i, firstRound[i].p1, true);
  }
  return rounds;
}

function reportWinner(rounds, round, index, winnerId, walkover = false) {
  const match = rounds[round][index];
  match.winner = winnerId;
  match.walkover = walkover;
  if (round + 1 < rounds.length) {
    const next = rounds[round + 1][Math.floor(index / 2)];
    if (index % 2 === 0) next.p1 = winnerId;
    else next.p2 = winnerId;
  }
}

function findNextMatch(rounds) {
  for (let r = 0; r < rounds.length; r++) {
    for (let i = 0; i < rounds[r].length; i++) {
      const m = rounds[r][i];
      if (m.winner === null && m.p1 !== null && m.p2 !== null) return { round: r, index: i };
    }
  }
  return null;
}

function champion(rounds) {
  return rounds[rounds.length - 1][0].winner;
}

module.exports = { generateBracket, reportWinner, findNextMatch, champion };
