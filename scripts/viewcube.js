import * as THREE from 'three';
import { camera, cameraControls } from './camera.js';
import { loader } from './cad_tools.js';
import { MeshStandardMaterial } from 'three/webgpu';
const viewcubeUrl = './assets/viewcube.glb';

let isDragging = false;
let startPointerX = 0;
let startPointerY = 0;
const CLICK_THRESHOLD = 1;


const viewcubeCanvas = document.getElementById('viewcube-canvas');

export const cubeScene = new THREE.Scene();
export const cubeCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
cubeCamera.zoom = 1.5;
cubeCamera.position.set(0, 0, 5);
cubeCamera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
cubeScene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
cubeScene.add(dirLight);


let rect = viewcubeCanvas.getBoundingClientRect();
export const renderer = new THREE.WebGLRenderer({
  canvas: viewcubeCanvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(rect.width, rect.height);
renderer.setClearColor(0x000000, 0);

function createFaceMaterial(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  // Clear layout transparent back
  ctx.clearRect(0, 0, 128, 128);
  
  // Draw an emulated chamfered button look directly onto the texture canvas
  const padding = 8;
  const size = 128 - padding * 2;
  const radius = 16; // Gives a beautiful rounded/beveled corner look
  
  ctx.fillStyle = '#5b6d74';
  ctx.strokeStyle = '#232729';
  ctx.lineWidth = 4;
  
  ctx.beginPath();
  ctx.moveTo(padding + radius, padding);
  ctx.lineTo(padding + size - radius, padding);
  ctx.quadraticCurveTo(padding + size, padding, padding + size, padding + radius);
  ctx.lineTo(padding + size, padding + size - radius);
  ctx.quadraticCurveTo(padding + size, padding + size, padding + size - radius, padding + size);
  ctx.lineTo(padding + radius, padding + size);
  ctx.quadraticCurveTo(padding, padding + size, padding, padding + size - radius);
  ctx.lineTo(padding, padding + radius);
  ctx.quadraticCurveTo(padding, padding, padding + radius, padding);
  ctx.closePath();
  
  ctx.fill();
  ctx.stroke();
  
  // Text Properties
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px AdwaitaMonoNerdFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true });
}

// Order matters for multi-material BoxGeometry arrays: Right, Left, Top, Bottom, Front, Back
const cubeMaterials = [
  createFaceMaterial('RIGHT'),
  createFaceMaterial('LEFT'),
  createFaceMaterial('TOP'),
  createFaceMaterial('BOTTOM'),
  createFaceMaterial('FRONT'),
  createFaceMaterial('BACK')
];

let viewCube;
loader.load(viewcubeUrl, (gltf) => {
  gltf.scene.traverse((child) => {
    viewCube = child;
    viewCube.name = 'viewcube'
    viewCube.scale.set(0.9, 0.9, 0.9);
    viewCube.material = new MeshStandardMaterial({color: 0x919599});
    cubeScene.add(viewCube);
  })
});


function snapNormalFromUV(normal, uv) {
  const res = normal.clone();
  const edgeThreshold = 0.18; // Click margin zone mapping to edges and corners
  
  // Calculate localized horizontal/vertical offsets across whatever face was clicked
  const uOffset = uv.x - 0.5;
  const vOffset = uv.y - 0.5;
  
  let hDir = Math.abs(uOffset) > (0.5 - edgeThreshold) ? Math.sign(uOffset) : 0;
  let vDir = Math.abs(vOffset) > (0.5 - edgeThreshold) ? Math.sign(vOffset) : 0;
  
  // Determine mapping transformations depending on active target face plane alignment
  if (Math.abs(normal.x) > 0.9) {
    res.z = -hDir * Math.sign(normal.x);
    res.y = vDir;
  } else if (Math.abs(normal.y) > 0.9) {
    res.x = hDir;
    res.z = -vDir * Math.sign(normal.y);
  } else if (Math.abs(normal.z) > 0.9) {
    res.x = hDir * Math.sign(normal.z);
    res.y = vDir;
  }
  
  return res.normalize();
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let initialClickX = 0;
let initialClickY = 0;
viewcubeCanvas.addEventListener('pointerdown', onCubePointerDown);
window.addEventListener('pointermove', onCubePointerMove);
window.addEventListener('pointerup', onCubePointerUp);

function onCubePointerDown(event) {
  // Capture initial coordinate markers
  startPointerX = event.clientX;
  startPointerY = event.clientY;
  initialClickX = event.clientX;
  initialClickY = event.clientY;
  isDragging = true;
  
  // Set pointer capture to gracefully handle dragging off the canvas boundary
  viewcubeCanvas.setPointerCapture(event.pointerId);
}

function onCubePointerMove(event) {
  if (!isDragging) return;

  const deltaX = event.clientX - startPointerX;
  const deltaY = event.clientY - startPointerY;

  // Check if pointer has moved past the click tolerance threshold
  if (Math.abs(deltaX) > CLICK_THRESHOLD || Math.abs(deltaY) > CLICK_THRESHOLD) {
    // 1. Kill any active snapping animations so they don't fight the user drag
    isAnimating = false; 

    // 2. Adjust main camera spherical coordinates based on mouse movement speed
    const sensitivity = 0.005; 
    cameraControls.theta += deltaX * sensitivity;
    cameraControls.phi -= deltaY * sensitivity;

    // Keep Phi within safe boundaries to prevent flipping upside down at poles
    cameraControls.phi = Math.max(0.01, Math.min(Math.PI - 0.01, cameraControls.phi));

    // Update markers for the next movement frame
    startPointerX = event.clientX;
    startPointerY = event.clientY;
  }
}

function onCubePointerUp(event) {
  if (!isDragging) return;
  isDragging = false;
  viewcubeCanvas.releasePointerCapture(event.pointerId);

  // Calculate overall total distance traveled from initial click point
  const totalDeltaX = event.clientX - initialClickX;
  const totalDeltaY = event.clientY - initialClickY;
  const totalDistance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

  // IF they barely moved, process this run as a standard quick face-alignment snap click!
  if (totalDistance <= CLICK_THRESHOLD) {
    rect = viewcubeCanvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cubeCamera);
    const intersects = raycaster.intersectObjects([viewCube]);
    
    if (intersects.length > 0) {
      const hitNormal = intersects[0].face.normal.clone();
      hitNormal.transformDirection(viewCube.matrixWorld);
      const targetDirection = snapNormal(hitNormal);
      rotateMainCameraTo(targetDirection);
    }
  }
}

function snapNormal(normal) {
  const snap = (val) => (Math.abs(val) < 0.35 ? 0 : Math.sign(val));
  return new THREE.Vector3(snap(normal.x), snap(normal.y), snap(normal.z)).normalize();
}

let isAnimating = false;
let startPhi = 0, startTheta = 0;
let targetPhi = 0, targetTheta = 0;
let progress = 0;
const ANIMATION_DURATION = 0.3; // Duration in seconds
const timer = new THREE.Timer(); // Tracks delta time across frames

function rotateMainCameraTo(direction) {
  startPhi = cameraControls.phi;
  startTheta = cameraControls.theta;

  targetPhi = Math.acos(Math.max(-1, Math.min(1, direction.y)));
  targetTheta = Math.atan2(direction.z, direction.x);

  let deltaTheta = targetTheta - startTheta;
  while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;
  while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
  targetTheta = startTheta + deltaTheta;

  progress = 0;
  isAnimating = true;
  
  timer.reset(); 
}

function animateMainCamera() {
  if (!isAnimating) return;

  timer.update(); 
  
  const dt = timer.getDelta(); 
  
  progress += dt / ANIMATION_DURATION;

  if (progress >= 1) {
    progress = 1;
    isAnimating = false;
  }

  const ease = 1 - Math.pow(1 - progress, 3);

  cameraControls.phi = THREE.MathUtils.lerp(startPhi, targetPhi, ease);
  cameraControls.theta = THREE.MathUtils.lerp(startTheta, targetTheta, ease);
}

export function updateRotation() {
    if (isAnimating) {
        animateMainCamera();
    }
    const x = cameraControls.radius * Math.sin(cameraControls.phi) * Math.cos(cameraControls.theta);
    const y = cameraControls.radius * Math.cos(cameraControls.phi);
    const z = cameraControls.radius * Math.sin(cameraControls.phi) * Math.sin(cameraControls.theta);
    cameraControls.update();

    const viewDir = new THREE.Vector3(x, y, z).normalize();
    cubeCamera.position.copy(viewDir).multiplyScalar(5);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
}