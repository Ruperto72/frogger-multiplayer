import { KEY_MAP } from './input.js';

export class TouchControls {
  constructor(input) {
    if (!matchMedia('(pointer: coarse)').matches) return;
    this._root = document.getElementById('touch-controls');
    this._root.classList.remove('hidden');

    for (const btn of this._root.querySelectorAll('button')) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.move(btn.dataset.dir);
      });
    }

    // Fysiskt tangentbordstryck ⇒ externt tangentbord finns: dölj permanent
    const onKeydown = (e) => {
      if (!KEY_MAP[e.code]) return;
      this._root.classList.add('hidden');
      window.removeEventListener('keydown', onKeydown);
    };
    window.addEventListener('keydown', onKeydown);
  }
}
