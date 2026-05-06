//import { bool, exponentialHeightFogFactor, select } from 'three/tsl';
//
//import * as THREE from 'three';
//import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
//import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
//import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
//import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
//import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
//import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
//import { TransformControls } from 'three/addons/controls/TransformControls.js';
//import { STLExporter } from 'three/addons/exporters/STLExporter.js';



createPrimitive('Cube 1', 'cube', [20, 20, 20], [0, 10, 0], default_material)

function animate() {
  requestAnimationFrame(animate);

  composer.render();
}

animate();