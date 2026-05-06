import { setCameraType } from 'camera.js';

export const canvas = document.querySelector('#bg');
export const camSelector = document.querySelector('#cam-switch');
camSelector.checked = true;
camSelector.addEventListener('change', () => {
  setCameraType();
});

export const selectionText = document.querySelector("#selected");
selectionText.textContent = "1 Selected: " + "ERROR";