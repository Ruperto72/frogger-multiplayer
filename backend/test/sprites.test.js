const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadSprites() {
  return import('../../frontend/js/sprites.js');
}

test('getGrid returnerar frog-up som standard vid okänd riktning', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('frog', 'up');
  const fallback = getGrid('frog', 'sideways');
  assert.deepEqual(fallback, up);
});

test('getGrid frog-right är horisontell spegling av frog-left', async () => {
  const { getGrid } = await loadSprites();
  const left = getGrid('frog', 'left');
  const right = getGrid('frog', 'right');
  const mirrored = left.map(row => [...row].reverse());
  assert.deepEqual(right, mirrored);
});

test('getGrid padda är samma grid oavsett riktning', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('toad', 'up');
  assert.deepEqual(getGrid('toad', 'down'), up);
  assert.deepEqual(getGrid('toad', 'left'), up);
  assert.deepEqual(getGrid('toad', 'right'), up);
});

test('getGrid grodans upp-grid har rätt dimensioner och ögon', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('frog', 'up');
  assert.equal(up.length, 12);
  assert.ok(up.every(row => row.length === 12));
  assert.equal(up[1][2], 3); // vänster ögonvitt
  assert.equal(up[1][3], 4); // vänster pupill
});

test('getPalette groda har klargrön kropp', async () => {
  const { getPalette } = await loadSprites();
  const p = getPalette('frog');
  assert.equal(p[1], '#25b34a');
  assert.equal(p[5], '#9fd987');
});

test('getPalette padda och groda har olika kroppsfärg', async () => {
  const { getPalette } = await loadSprites();
  const frog = getPalette('frog');
  const toad = getPalette('toad');
  assert.equal(frog[1], '#25b34a');
  assert.equal(toad[1], '#5c7a3c');
  assert.notEqual(frog[1], toad[1]);
});

test('getPalette okänt djur faller tillbaka på frog', async () => {
  const { getPalette } = await loadSprites();
  assert.deepEqual(getPalette('rainbow'), getPalette('frog'));
});

test('getPalette har fast ögonvitt/pupill oavsett djur', async () => {
  const { getPalette } = await loadSprites();
  for (const animal of ['frog', 'toad']) {
    const p = getPalette(animal);
    assert.equal(p[3], '#f4f4e6');
    assert.equal(p[4], '#111');
  }
});

test('drawSprite ritar en fillRect per icke-transparent pixel', async () => {
  const { drawSprite } = await loadSprites();
  const calls = [];
  const ctx = {
    set fillStyle(v) { calls.push({ style: v, rects: [] }); },
    fillRect(x, y, w, h) { calls.at(-1).rects.push([x, y, w, h]); }
  };
  drawSprite(ctx, { animal: 'frog', direction: 'up', cx: 24, cy: 24, cellSize: 48 });
  const totalRects = calls.reduce((n, c) => n + c.rects.length, 0);
  assert.ok(totalRects > 0);
  // Alla rektanglar är 4×4 (48/12) och inom cellens 0..48-ruta relativt cx-24/cy-24
  for (const c of calls) {
    for (const [x, y, w, h] of c.rects) {
      assert.equal(w, 4);
      assert.equal(h, 4);
      assert.ok(x >= 0 && x <= 44);
      assert.ok(y >= 0 && y <= 44);
    }
  }
});
