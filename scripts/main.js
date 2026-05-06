import { update } from 'three/examples/jsm/libs/tween.module.js';
import { createPrimitive, default_material } from './cad_tools.js';
import { composer } from './camera.js';
import { updateEditorControls } from './editor_controls.js';


createPrimitive('Cube 1', 'cube', [20, 20, 20], [0, 10, 0], default_material)

function animate() {
  requestAnimationFrame(animate);

  updateEditorControls();

  composer.render();
}

animate();