import { createPrimitive } from 'cad_tools.js';
import { composer } from 'camera.js';


createPrimitive('Cube 1', 'cube', [20, 20, 20], [0, 10, 0], default_material)

function animate() {
  requestAnimationFrame(animate);

  composer.render();
}

animate();