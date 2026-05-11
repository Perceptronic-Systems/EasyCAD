import * as THREE from 'three';
import { bool, exponentialHeightFogFactor, select } from 'three/tsl';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';


export const scene = new THREE.Scene();

export const canvas = document.querySelector('#bg');
export let width = canvas.offsetWidth;
export let height = canvas.offsetHeight;

export const frustumSize = 40;
export const aspectRatio = width / height;

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

export let camera = orthoCamera;

// Rendering
export const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0);

// Post Processing Effects
export const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const outlinePass = new OutlinePass(
  new THREE.Vector2(width, height),
  scene,
  camera
);
outlinePass.edgeStrength = 1.1;
outlinePass.edgeGlow = 0.0;
outlinePass.visibleEdgeColor.set('#d2fdff');
composer.addPass(outlinePass);
const gammaPass = new ShaderPass(GammaCorrectionShader);
composer.addPass(gammaPass);
composer.setPixelRatio(window.devicePixelRatio);

const selectionHighlight = 0x081115;
export function outlineObject(mesh) {
  outlinePass.selectedObjects.push(mesh);
  mesh.material.emissive.setHex(selectionHighlight);
}

export function clearOutlines() {
  outlinePass.selectedObjects = [];
  const children = scene.children.filter(child => child.isMesh);
  children.forEach(child => {
    child.material.emissive.setHex(0x000000);
  })
}

// View Selection
export function setCameraType(orthographic) {
  if (orthographic) {
    camera = orthoCamera;
    camera.position.copy(perspCamera.position);
  } else {
    camera = perspCamera;
    camera.position.copy(orthoCamera.position);
    camera.zoom = 1;
  }
  renderPass.camera = camera;
  outlinePass.renderCamera = camera;
  camera.updateProjectionMatrix();
  cameraControls.cam = camera;
  cameraControls.update();
  handleResize();
}

// Resizing
function handleResize() {
  width = canvas.parentElement.offsetWidth;
  height = canvas.parentElement.offsetHeight;
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

// Orbit Controls
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
export const cameraControls = new orbitControls(camera, canvas);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
const directionalLightA = new THREE.DirectionalLight(0xffffff, 0.8);
const directionalLightB = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLightA.position.set(5, 10, 2);
directionalLightB.position.set(-3, 9, -2);
scene.add(ambientLight);
scene.add(directionalLightA);
scene.add(directionalLightB);