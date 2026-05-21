import * as THREE from 'three';
import { camera, cameraControls } from './camera.js';

const viewcubeCanvas = document.getElementById('viewcube-canvas');

export const cubeScene = new THREE.Scene();
export const cubeCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
cubeCamera.zoom = 1.5;
cubeCamera.position.set(0, 0, 5);
cubeCamera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
cubeScene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
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
const cubeGeometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
const cubeMaterials = [
  createFaceMaterial('RIGHT'),
  createFaceMaterial('LEFT'),
  createFaceMaterial('TOP'),
  createFaceMaterial('BOTTOM'),
  createFaceMaterial('FRONT'),
  createFaceMaterial('BACK')
];

const viewCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
cubeScene.add(viewCube);

// Add an underlying darker interior box to show behind the transparent rounded face corners
const innerGeo = new THREE.BoxGeometry(1.35, 1.35, 1.35);
const innerMat = new THREE.MeshBasicMaterial({ color: 0x232729 });
const innerCube = new THREE.Mesh(innerGeo, innerMat);
viewCube.add(innerCube);

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
viewcubeCanvas.addEventListener('pointerdown', onCubeClick);

function onCubeClick(event) {
  rect = viewcubeCanvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, cubeCamera);
  const intersects = raycaster.intersectObject(viewCube);
  
  if (intersects.length > 0) {
    console.log('hit!');
    
    // Obtain face normal of the box geometry directly
    const hitNormal = intersects[0].face.normal.clone();
    hitNormal.transformDirection(viewCube.matrixWorld);
    
    // Fall back to uv checking if they hit close to an edge/corner region
    const uv = intersects[0].uv;
    const targetDirection = snapNormalFromUV(hitNormal, uv);
    
    rotateMainCameraTo(targetDirection);
  }
}

function rotateMainCameraTo(direction) {
  // Convert the target directional vector into polar spherical coordinates (phi, theta)
  // to feed back nicely into your cameraControls setup.
  const radius = cameraControls.radius || 10;
  
  // Calculate Target Phi & Theta based on vector
  const targetPhi = Math.acos(Math.max(-1, Math.min(1, direction.y)));
  let targetTheta = Math.atan2(direction.z, direction.x);

  // Smoothly interpolate your main camera angles over your render loop
  animateMainCamera(targetPhi, targetTheta);
}

function animateMainCamera(tPhi, tTheta) {
  // Animate using a basic lerp inside your main requestAnimationFrame loop, 
  // or pass these directly to a library like GSAP if you use one:
  // gsap.to(cameraControls, { phi: tPhi, theta: tTheta, duration: 0.4 });
  
  // Fallback direct assignment if your camera controls update immediately:
  cameraControls.phi = tPhi;
  cameraControls.theta = tTheta;
}

export function updateRotation() {
    const x = cameraControls.radius * Math.sin(cameraControls.phi) * Math.cos(cameraControls.theta);
    const y = cameraControls.radius * Math.cos(cameraControls.phi);
    const z = cameraControls.radius * Math.sin(cameraControls.phi) * Math.sin(cameraControls.theta);
    cameraControls.update();

    const viewDir = new THREE.Vector3(x, y, z).normalize();
    cubeCamera.position.copy(viewDir).multiplyScalar(5);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
}