import { bool, exponentialHeightFogFactor, select } from 'three/tsl';
import './style.css';

import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';




const scene = new THREE.Scene();
const canvas = document.querySelector('#bg');
const camSelector = document.querySelector('#cam-switch');
camSelector.checked = true;
const gridHelper = new THREE.GridHelper(260, 26);
scene.add(gridHelper);
let width = canvas.offsetWidth;
let height = canvas.offsetHeight;


// Camera
const frustumSize = 40;
const aspectRatio = width / height;

const orthoCamera = new THREE.OrthographicCamera(
  (frustumSize * aspectRatio) / -2,
  (frustumSize * aspectRatio) / 2,
  frustumSize / 2,
  frustumSize / -2,
  -1000,
  1000);
const perspCamera = new THREE.PerspectiveCamera(frustumSize * 2, aspectRatio, 0.001, 1000);
perspCamera.position.set(25, 60, -75)
perspCamera.lookAt(0, 0, 0);
orthoCamera.position.copy(perspCamera.position);
orthoCamera.quaternion.copy(perspCamera.quaternion);

let camera = orthoCamera;

camSelector.addEventListener('change', () => {
  setCameraType();
});

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
let renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let outlinePass = new OutlinePass(
  new THREE.Vector2(width, height),
  scene,
  camera
);
outlinePass.edgeStrength = 1.5;
outlinePass.edgeGlow = 0.0;
outlinePass.visibleEdgeColor.set('#d2fdff');
composer.addPass(outlinePass);
const gammaPass = new ShaderPass(GammaCorrectionShader);
composer.addPass(gammaPass);
composer.setPixelRatio(window.devicePixelRatio);

// View Selection
function setCameraType() {
  if (camSelector.checked) {
    camera = orthoCamera;
    camera.position.copy(perspCamera.position);
  } else {
    camera = perspCamera;
    camera.position.copy(orthoCamera.position);
    camera.zoom = 1;
  }
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  outlinePass = new OutlinePass(
    new THREE.Vector2(width, height),
    scene,
    camera
  );
  composer.addPass(outlinePass);
  controls.cam = camera;
  controls.update();
  handleResize();
}

// Resizing
function handleResize() {
  width = canvas.offsetWidth;
  height = canvas.offsetHeight;
  const aspect = width / height;
  orthoCamera.aspect = aspect;
  perspCamera.aspect = aspect;
  orthoCamera.left = - frustumSize * aspect;
  orthoCamera.right = frustumSize * aspect;
  orthoCamera.top = frustumSize;
  orthoCamera.bottom = - frustumSize;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  const pixelRatio = renderer.getPixelRatio();
  outlinePass.resolution.set(width * pixelRatio, height * pixelRatio);
}
window.addEventListener('resize', handleResize);
handleResize();

// Controls
class orbitControls {
  constructor(cam, domElement) {
    this.active = true;
    this.cam = cam;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 0, 0);
    this.sensitivity = 0.005;
    this.panSpeed = 0.08;
    this.zoomSpeed = 0.1;
    this.zoomFactor = 80;
    this.zoomStart = -0.05;
    this.radius = 50;
    this.theta = 0.5; // Horizontal orbit
    this.phi = 1.000; // Vertical orbit
    this.isDragging = false;
    this.prevMouse = { x: 0.00, y: 0.00 };
    this.initListeners();
    this.update();
    this.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
  initListeners() {
    this.domElement.addEventListener('mousedown', (e) => {
      this.mouseButton = e.button;
      this.isDragging = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.active) return;
      const deltaX = e.clientX - this.prevMouse.x;
      const deltaY = e.clientY - this.prevMouse.y;
      if (this.mouseButton === 0) {
        this.theta += deltaX * this.sensitivity;
        this.phi -= deltaY * this.sensitivity;
      } else if (this.mouseButton === 2) {
        const matrix = new THREE.Matrix4()
        matrix.extractRotation(this.cam.matrix);
        const left = new THREE.Vector3(-1, 0, 0).applyMatrix4(matrix);
        const up = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix);
        this.target.addScaledVector(left, (deltaX * this.panSpeed) / this.cam.zoom);
        this.target.addScaledVector(up, (deltaY * this.panSpeed) / this.cam.zoom);
      }
      this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));
      this.prevMouse = { x: e.clientX, y: e.clientY };
      this.update();
    });
    window.addEventListener('mouseup', () => this.isDragging = false);
    this.domElement.addEventListener('wheel', (e) => {
      this.radius = Math.max(1, Math.min(600, this.radius + (e.deltaY * 0.05 * this.zoomSpeed) * this.radius / 10));
      scene.add(gridHelper);
      this.update();
    });
  }
  zoom() {
    this.cam.zoom = 1 / (this.radius / this.zoomFactor) + this.zoomStart;
  }
  update() {
    const x = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    this.cam.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.cam.lookAt(this.target);
    if (this.cam.isOrthographicCamera) {
      this.zoom();
    } else {
      this.cam.zoom = 1;
    }
    this.cam.updateProjectionMatrix();
  }
}
const controls = new orbitControls(camera, canvas);
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setTranslationSnap(5);
transformControls.setScaleSnap(0.5);
transformControls.setRotationSnap(Math.PI / 8);
transformControls.addEventListener('dragging-changed', (e) => {
  controls.active = !e.value;
});
transformControls.addEventListener('change', (e) => {
  if (editorControls.innerHTML != "") {
    const mainSelection = Object.values(selectedObjects)[0];
    switch (activeTool) {
      case "move":
        const x_pos = editorControls.querySelector('#pos-x');
        const y_pos = editorControls.querySelector('#pos-y');
        const z_pos = editorControls.querySelector('#pos-z');
        const pos_snap = editorControls.querySelector('#snap_pos_amount');
        transformControls.setTranslationSnap(pos_snap.value);
        x_pos.value = mainSelection.position.x;
        y_pos.value = mainSelection.position.y;
        z_pos.value = mainSelection.position.z;
        break;
      case "scale":
        const x_scale = editorControls.querySelector('#scale-x');
        const y_scale = editorControls.querySelector('#scale-y');
        const z_scale = editorControls.querySelector('#scale-z');
        const scale_snap = editorControls.querySelector('#snap_scale_amount');
        transformControls.setScaleSnap(scale_snap.value);
        x_scale.value = mainSelection.scale.x;
        y_scale.value = mainSelection.scale.y;
        z_scale.value = mainSelection.scale.z;
        break;
      case "rotate":
        const x_rot = editorControls.querySelector('#rot-x');
        const y_rot = editorControls.querySelector('#rot-y');
        const z_rot = editorControls.querySelector('#rot-z');
        const rot_snap = editorControls.querySelector('#snap_rotation_amount');
        transformControls.setRotationSnap(rot_snap.value);
        x_rot.value = mainSelection.rotation.x;
        y_rot.value = mainSelection.rotation.y;
        z_rot.value = mainSelection.rotation.z;
        break;
    }
  }
});
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
const objects = {};
const default_material = new THREE.MeshStandardMaterial({ color: 0x1b8237 });
function createPrimitive(name, shape, size, position = [0, 0, 0], material = default_material, selectOnFinish = true) {
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
  objects[tempName] = shape;
  if (selectOnFinish) selectObject(tempName);
  return mesh;
}
function removeObject(objectName) {
  const mesh = scene.getObjectByName(objectName);
  scene.remove(mesh);
  delete objects[objectName];
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
  const intersects = raycaster.intersectObjects(scene.children.filter(child => child.isMesh && Object.keys(objects).includes(child.name)), true);
  if (intersects.length > 0 && activeTool == null) {
    const hit = intersects[0].object;
    selectObject(hit.name, shiftDown);
  }
  //scene.add(new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 600, 0xff0000));
}
window.addEventListener('click', onMouseClick);

// Editor controls functionality
const editorControls = document.querySelector("#editor-controls");
editorControls.style.display = 'None';
function setEditor(content_items) {
  for (const item of content_items) {
    let domElement;
    if (item.element == "property") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const label = document.createElement('label');
      const value = document.createElement('input');
      label.innerHTML = item.content;
      value.id = item.id;
      value.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(value);
    } else if (item.element == "checkbox") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = item.id;
      checkbox.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(checkbox);
    } else if (item.element == "confirmation") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const cancel = document.createElement('button');
      const apply = document.createElement('button');
      cancel.id = 'cancel';
      cancel.innerHTML = "Cancel";
      apply.id = item.id;
      apply.classList.add('apply');
      apply.innerHTML = "Apply";
      domElement.appendChild(cancel);
      domElement.appendChild(apply);
    } else {
      domElement = document.createElement(item.element);
      if (item.id) domElement.id = item.id;
      if (item.class) domElement.classList.add(item.class);
      domElement.innerHTML = item.content;
    }
    editorControls.appendChild(domElement);
  }
  editorControls.style.display = 'flex';
}

function hideEditor() {
  editorControls.hidden = true;
  editorControls.innerHTML = "";
}

// Tool Functionality
let originPos = null;
let originScale = null;
let originRot = null;
let activeTool = null;
const moveButton = document.querySelector("#move");
const scaleButton = document.querySelector("#scale");
const rotateButton = document.querySelector("#rotate");
const mergeButton = document.querySelector("#merge");
const subtractButton = document.querySelector("#subtract");
const intersectionButton = document.querySelector("#intersect");
const exportButton = document.querySelector("#export");
function setTool(tool) {
  editorControls.innerHTML = "";
  const selection = Object.values(selectedObjects);
  if (activeTool != tool && selection.length > 0) {
    activeTool = tool;
    transformControls.detach();
    const mainSelection = Object.values(selectedObjects)[0];
    originPos = mainSelection.position.clone();
    originScale = mainSelection.scale.clone();
    originRot = mainSelection.rotation.clone();
    switch (tool) {
      case "move":
        setEditor([{ element: 'div', content: "Move Object" },
        { element: 'property', content: "Snap amount", id: "snap_pos_amount", defaultValue: transformControls.translationSnap },
        { element: 'property', content: "X", id: "pos-x", defaultValue: mainSelection.position.x },
        { element: 'property', content: "Y", id: "pos-y", defaultValue: mainSelection.position.y },
        { element: 'property', content: "Z", id: "pos-z", defaultValue: mainSelection.position.z },
        { element: 'confirmation', id: 'apply-pos' }
        ]);
        transformControls.setMode('translate');
        break;
      case "scale":
        setEditor([{ element: 'div', content: "Scale Object" },
        { element: 'property', content: "Snap amount", id: "snap_scale_amount", defaultValue: transformControls.scaleSnap },
        { element: 'property', content: "X", id: "scale-x", defaultValue: mainSelection.scale.x },
        { element: 'property', content: "Y", id: "scale-y", defaultValue: mainSelection.scale.y },
        { element: 'property', content: "Z", id: "scale-z", defaultValue: mainSelection.scale.z },
        { element: 'confirmation', id: 'apply-scale' }
        ]);
        transformControls.setMode('scale');
        break;
      case "rotate":
        setEditor([{ element: 'div', content: "Rotate Object" },
        { element: 'property', content: "Snap amount", id: "snap_rotation_amount", defaultValue: transformControls.rotationSnap },
        { element: 'property', content: "X", id: "rot-x", defaultValue: mainSelection.rotation.x },
        { element: 'property', content: "Y", id: "rot-y", defaultValue: mainSelection.rotation.y },
        { element: 'property', content: "Z", id: "rot-z", defaultValue: mainSelection.rotation.z },
        { element: 'confirmation', id: 'apply-rot' }
        ]);
        transformControls.setMode('rotate');
        break
    }
    transformControls.attach(selection[0]);
  }
}
function unselectTool() {
  activeTool = null;
  transformControls.detach();
  hideEditor();
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
      unselectTool()
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
function cancelEdit() {
  unselectTool()
  const mainSelection = Object.values(selectedObjects)[0];
  mainSelection.position.copy(originPos);
  mainSelection.scale.copy(originScale);
  mainSelection.rotation.copy(originRot);
}
document.addEventListener('click', function (event) {
  if (event.target) {
    switch (event.target.id) {
      case 'cancel':
        cancelEdit();

        break;
      case 'apply-pos':
        const x_pos = document.querySelector('#pos-x').value;
        const y_pos = document.querySelector('#pos-y').value;
        const z_pos = document.querySelector('#pos-z').value;
        const newPos = new THREE.Vector3(x_pos, y_pos, z_pos);
        for (const mesh of Object.values(selectedObjects)) {
          mesh.position.copy(newPos);
        }
        unselectTool();
        break;
      case 'apply-scale':
        const x_scale = document.querySelector('#scale-x').value;
        const y_scale = document.querySelector('#scale-y').value;
        const z_scale = document.querySelector('#scale-z').value;
        const newScale = new THREE.Vector3(x_scale, y_scale, z_scale);
        for (const mesh of Object.values(selectedObjects)) {
          mesh.scale.copy(newScale);
        }
        unselectTool();
        break;
      case 'apply-rot':
        const x_rot = document.querySelector('#rot-x').value;
        const y_rot = document.querySelector('#rot-y').value;
        const z_rot = document.querySelector('#rot-z').value;
        for (const mesh of Object.values(selectedObjects)) {
          mesh.rotation.set(x_rot, y_rot, z_rot);
        }
        unselectTool();
        break;
    }
  }
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
  objects[resultName] = 'composite_part';
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

createPrimitive('Cube 1', 'cube', [20, 20, 20], [0, 10, 0], default_material)

function animate() {
  requestAnimationFrame(animate);

  composer.render();
}

animate();