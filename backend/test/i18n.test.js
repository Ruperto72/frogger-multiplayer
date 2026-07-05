const { test } = require('node:test');
const assert = require('node:assert/strict');

async function makeI18n() {
  // Cache-bust så varje test får färskt modul-state (lang är modulglobal)
  return import(`../../frontend/js/i18n.js?${Math.random()}`);
}

test('detectLang: sparat giltigt val vinner över webbläsarspråk', async () => {
  const { detectLang } = await makeI18n();
  assert.equal(detectLang('sv', 'en-US'), 'sv');
  assert.equal(detectLang('en', 'sv-SE'), 'en');
});

test('detectLang: sv-prefix ger svenska, allt annat engelska', async () => {
  const { detectLang } = await makeI18n();
  assert.equal(detectLang(null, 'sv-SE'), 'sv');
  assert.equal(detectLang(null, 'sv'), 'sv');
  assert.equal(detectLang(null, 'en-GB'), 'en');
  assert.equal(detectLang(null, 'de-DE'), 'en');
  assert.equal(detectLang(null, undefined), 'en');
  assert.equal(detectLang('xx', 'de'), 'en'); // ogiltigt sparat val ignoreras
});

test('t: slår upp i aktivt språk och interpolerar variabler', async () => {
  const { t, setLang } = await makeI18n();
  setLang('sv');
  assert.equal(t('start.players', { n: 8 }), '8 spelare');
  assert.equal(t('t.joined', { count: 3, size: 8 }), '3 av 8 anslutna');
  setLang('en');
  assert.equal(t('start.players', { n: 8 }), '8 players');
  assert.equal(t('t.joined', { count: 3, size: 8 }), '3 of 8 joined');
});

test('t: okänd nyckel returnerar nyckeln själv', async () => {
  const { t } = await makeI18n();
  assert.equal(t('finns.inte'), 'finns.inte');
});

test('setLang: ogiltigt språk ignoreras', async () => {
  const { setLang, getLang } = await makeI18n();
  setLang('en');
  setLang('xx');
  assert.equal(getLang(), 'en');
});

test('paritet: sv och en har exakt samma nycklar', async () => {
  const { LANGS } = await makeI18n();
  assert.deepEqual(Object.keys(LANGS.sv).sort(), Object.keys(LANGS.en).sort());
});
