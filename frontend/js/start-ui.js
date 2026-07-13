import { t, setLang, getLang } from './i18n.js';

export class StartUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;

    this._root   = document.getElementById('start');
    this._name   = document.getElementById('start-name');
    this._code   = document.getElementById('start-code');
    this._size   = document.getElementById('start-size');
    this._bestof = document.getElementById('start-bestof');
    this._error  = document.getElementById('start-error');

    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('name') : null;
    if (savedName) {
      this._name.value = savedName;
      this._state.profile = { name: savedName };
    }

    this._fillSizeOptions();

    this._code.value = new URLSearchParams(location.search).get('code') ?? '';

    document.getElementById('start-quick').addEventListener('click', () => {
      this._saveProfile();
      // Förifyll snabbmatchens lobbypanel med samma namn
      document.getElementById('lobby-name').value = this._state.profile.name;
      this._net.send({ type: 'quick_match' });
    });

    document.getElementById('start-create').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'create_tournament',
        size: Number(this._size.value),
        bestOf: Number(this._bestof.value),
        name: this._state.profile.name
      });
    });

    document.getElementById('start-join').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'join_tournament',
        code: this._code.value.trim().toUpperCase(),
        name: this._state.profile.name
      });
    });

    this._langBtns = {
      sv: document.getElementById('lang-sv'),
      en: document.getElementById('lang-en')
    };
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.addEventListener('click', () => {
        setLang(l);
        this._onLangChange();
      });
    }
    this._onLangChange();
  }

  _onLangChange() {
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.classList.toggle('active', l === getLang());
    }
    this._fillSizeOptions();
  }

  _fillSizeOptions() {
    const current = this._size.value || '8';
    this._size.replaceChildren();
    for (let n = 2; n <= 16; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = t('start.players', { n });
      if (String(n) === current) opt.selected = true;
      this._size.appendChild(opt);
    }
  }

  _saveProfile() {
    const name = this._name.value.trim();
    this._state.profile = { name };
    this._state.lastError = null;
    if (typeof localStorage !== 'undefined') localStorage.setItem('name', name);
  }

  // Anropas från rAF-loopen
  update() {
    const visible = this._state.mode === null;
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;
    const text = this._state.lastError ? t(`error.${this._state.lastError}`) : '';
    if (this._error.textContent !== text) this._error.textContent = text;
  }
}
