import { bool, exponentialHeightFogFactor, select } from 'three/tsl';
import './style.css';

import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';




const scene = new THREE.Scene();
const canvas = document.querySelector('#bg');
const gridHelper = new THREE.GridHelper(250, 25);
scene.add(gridHelper);
let width = canvas.offsetWidth;
let height = canvas.offsetHeight;


// Camera
const frustumSize = 40;
const aspectRatio = width / height;

let orthographic = false;

let camera = new THREE.OrthographicCamera(
  (frustumSize * aspectRatio) / -2,
  (frustumSize * aspectRatio) / 2,
  frustumSize / 2,
  frustumSize / -2,
  -1000,
  1000);

if (orthographic == false) {
  camera = new THREE.PerspectiveCamera(frustumSize * 2, aspectRatio, 0.001, 1000);
  camera.position.set(25, 60, -75)
  camera.lookAt(0, 0, 0);
} else {
  camera.position.set(1, 1, 1);
  camera.lookAt(0, 0, 0);
}

// Rendering
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0);

// Post Processing Effects
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const outlinePass = new OutlinePass(
  new THREE.Vector2(width, height),
  scene,
  camera
);
outlinePass.edgeStrength = 1.6;
outlinePass.edgeGlow = 1.0;
outlinePass.visibleEdgeColor.set('#baf5f8');
composer.addPass(outlinePass);
composer.setPixelRatio(window.devicePixelRatio);

// Resizing
function handleResize() {
  width = canvas.offsetWidth;
  height = canvas.offsetHeight;
  const aspect = width / height;
  camera.aspect = aspect;
  if (orthographic) {
    camera.left = - frustumSize * aspect;
    camera.right = frustumSize * aspect;
    camera.top = frustumSize;
    camera.bottom = - frustumSize;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  const pixelRatio = renderer.getPixelRatio();
  outlinePass.resolution.set(width * pixelRatio, height * pixelRatio);
}
window.addEventListener('resize', handleResize);
handleResize();

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value;
});
transformControls.addEventListener('change', () => composer.render());
const transformGizmo = transformControls.getHelper()
scene.add(transformGizmo);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
const directionalLightA = new THREE.DirectionalLight(0xffffff, 0.8);
const directionalLightB = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLightA.position.set(5, 10, 2);
directionalLightB.position.set(-3, 9, -2);
scene.add(ambientLight);
scene.add(directionalLightA);
scene.add(directionalLightB);


// Primitive Functionality
const default_material = new THREE.MeshStandardMaterial({ color: 0xf25050 });
function createPrimitive(name, shape, size, position, material, selectOnFinish = true) {
  let mesh = null;
  if (shape == "cube" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  } else if (shape == "sphere" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(size[0], size[1], size[2]), material);
  } else if (shape == "cylinder" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(size[0], size[1], size[2]), material);
  } else {
    return null;
  }
  mesh.position.set(position[0], position[1], position[2]);
  let i = 0;
  let tempName = name;
  while (scene.getObjectByName(tempName)) {
    i += 1;
    tempName = name + " " + i;
  }
  mesh.name = tempName;
  scene.add(mesh);
  if (selectOnFinish) selectObject(tempName);
  return mesh;
}
function removeObject(objectName) {
  const mesh = scene.getObjectByName(objectName);
  scene.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();
  mesh.material = null;
}


// Selection Functionality
let selectedObjects = {};
const selectionText = document.querySelector("#selected");

function selectObject(object, keep = false) {
  const mesh = scene.getObjectByName(object);
  if (mesh) {
    if (keep) {
      selectedObjects[object] = mesh;
      const objectNames = Object.keys(selectedObjects);
      selectionText.textContent = objectNames.length + " Selected: " + objectNames.join(", ");
    } else {
      deselectObjects();
      selectedObjects[object] = mesh
      if (activeTool != null) {
        transformControls.detach();
        transformControls.attach(mesh);
      }
      selectionText.textContent = "1 Selected: " + object;
    }
    outlinePass.selectedObjects.push(mesh);
  }
}

// Raycasting
const mouse = new THREE.Vector2();
function onMouseClick(event) {
  if (transformControls.dragging) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycast();
}
const raycaster = new THREE.Raycaster();
function raycast() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children.filter(child => child.isMesh), true); 1
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    if (hit.name != "") {
      selectObject(hit.name, shiftDown);
    }
  }
}
window.addEventListener('click', onMouseClick);

// Tool Functionality
let activeTool = null;
const moveButton = document.querySelector("#move");
const scaleButton = document.querySelector("#scale");
const rotateButton = document.querySelector("#rotate");
const mergeButton = document.querySelector("#merge");
const subtractButton = document.querySelector("#subtract");
const intersectionButton = document.querySelector("#intersect");
const exportButton = document.querySelector("#export");
function setTool(tool) {
  const selection = Object.values(selectedObjects);
  if (activeTool != tool && selection.length > 0) {
    activeTool = tool;
    transformControls.detach();
    switch (tool) {
      case "move":
        transformControls.setMode('translate');
        break;
      case "scale":
        transformControls.setMode('scale');
        break;
      case "rotate":
        transformControls.setMode('rotate');
        break
    }
    transformControls.attach(selection[0]);
  }
}
moveButton.addEventListener("click", () => {
  setTool('move');
});
scaleButton.addEventListener("click", () => {
  setTool('scale');
});
rotateButton.addEventListener("click", () => {
  setTool('rotate');
});
mergeButton.addEventListener("click", () => {
  booleanToSelection(ADDITION, 'Combined Part');
});
subtractButton.addEventListener("click", () => {
  booleanToSelection(SUBTRACTION, 'Combined Part');
});
intersectionButton.addEventListener("click", () => {
  booleanToSelection(INTERSECTION, 'Combined Part');
});
const exporter = new STLExporter();
exportButton.addEventListener("click", () => {
  for (const mesh of Object.values(selectedObjects)) {
    const result = exporter.parse(mesh);
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = prompt("Enter a filename for your STL:", mesh.name + ".stl");
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }
});
let shiftDown = false;
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case "Escape":
      transformControls.detach();
      activeTool = null;
      break;
    case 'Shift':
      shiftDown = true;
      break
    case 'Delete':
      if (confirm("Are you sure you would like to delete selected objects?")) {
        for (const name of Object.keys(selectedObjects)) {
          removeObject(name);
        }
        deselectObjects();
      }
    case 'g':
      setTool('move');
      break;
    case 'r':
      setTool('rotate');
      break;
    case 's':
      setTool('scale');
      break;
  }

});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') shiftDown = false;
});

function deselectObjects() {
  transformControls.detach();
  activeTool = null;
  selectionText.textContent = "Nothing selected";
  outlinePass.selectedObjects = [];
  selectedObjects = {};
}

// Boolean Functionality
function booleanToSelection(operation, resultName) {
  let selectedNames = Object.keys(selectedObjects)
  if (selectedNames.length > 2) {
    alert("Sorry! For now boolean operations only support the selection of 2 objects at a time.");
  } else if (selectedNames.length < 2) {
    alert("Whoops! You need to have 2 objects selected in order to use this operation.")
  } else {
    booleanOperation(operation, selectedNames[0], selectedNames[1], resultName);
  }
}
function booleanOperation(operation, objectA, objectB, resultName) {
  const meshA = scene.getObjectByName(objectA);
  const meshB = scene.getObjectByName(objectB);
  const brushA = new Brush(meshA.geometry, meshA.material);
  const brushB = new Brush(meshB.geometry, meshB.material);
  brushA.position.copy(meshA.position);
  brushA.quaternion.copy(meshA.quaternion);
  brushA.scale.copy(meshA.scale);
  brushA.updateMatrixWorld();
  brushB.position.copy(meshB.position);
  brushB.quaternion.copy(meshB.quaternion);
  brushB.scale.copy(meshB.scale);
  brushB.updateMatrixWorld();

  const evaluator = new Evaluator();
  const result = evaluator.evaluate(brushA, brushB, operation);
  removeObject(objectA);
  removeObject(objectB);
  result.name = resultName;
  scene.add(result);
  selectObject(resultName);
}

const cubeButton = document.querySelector("#cube");
cubeButton.addEventListener("click", () => {
  createPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0], default_material);
});
const sphereButton = document.querySelector("#sphere");
sphereButton.addEventListener("click", () => {
  createPrimitive("Sphere", "sphere", [10, 32, 32], [0, 10, 0], default_material);
});
const cylinderButton = document.querySelector("#cylinder");
cylinderButton.addEventListener("click", () => {
  createPrimitive("Cylinder", "cylinder", [10, 10, 20], [0, 10, 0], default_material);
});

function animate() {
  requestAnimationFrame(animate);

  composer.render();
}

animate();