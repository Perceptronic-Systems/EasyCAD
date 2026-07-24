import * as THREE from 'three';
import { scene, camera, cameraControls, canvas } from './camera.js';
import { instantiateObject } from './cad_tools.js';

// --- State Variables ---
let active = false;
let sketchPlane = new THREE.Plane();
let currentPlaneName = 'xz';
let currentOffset = 0;

// Points tracking
let points3D = []; // World positions
let points2D = []; // Local 2D coordinates on the sketch plane
let currentBasis = { u: new THREE.Vector3(), v: new THREE.Vector3(), normal: new THREE.Vector3(), origin: new THREE.Vector3() };

// Visual Helpers
let previewLine = null;
let pointMarkers = [];
let hoverPoint = null;
const SNAP_THRESHOLD_WORLD = 1.0; // Distance to snap to start point

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Basis & Plane Setup ---

/**
 * Defines the 3D plane and 2D coordinate basis vectors based on selection.
 */
export function setSketchPlane(planeName = 'xz', offset = 0) {
  currentPlaneName = planeName.toLowerCase();
  currentOffset = Number(offset) || 0;

  const normal = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const origin = new THREE.Vector3();

  switch (currentPlaneName) {
    case 'xy':
      normal.set(0, 0, 1);
      u.set(1, 0, 0);
      v.set(0, 1, 0);
      origin.set(0, 0, currentOffset);
      break;
    case 'yz':
      normal.set(1, 0, 0);
      u.set(0, 0, -1);
      v.set(0, 1, 0);
      origin.set(currentOffset, 0, 0);
      break;
    case 'xz':
    default:
      normal.set(0, 1, 0);
      u.set(1, 0, 0);
      v.set(0, 0, -1);
      origin.set(0, currentOffset, 0);
      break;
  }

  sketchPlane.setFromNormalAndCoplanarPoint(normal, origin);
  currentBasis = { u, v, normal, origin };

  // Dynamically re-align the camera whenever the plane changes
  alignCameraToPlane(currentPlaneName);
}

/**
 * Aligns camera orientation directly perpendicular to the active sketch plane.
 */
export function alignCameraToPlane(planeName) {
  cameraControls.active = false;

  switch (planeName.toLowerCase()) {
    case 'xz':
      cameraControls.phi = 0.001;
      cameraControls.theta = Math.PI / 2;
      break;
    case 'xy':
      cameraControls.phi = Math.PI / 2;
      cameraControls.theta = Math.PI / 2;
      break;
    case 'yz':
      cameraControls.phi = Math.PI / 2;
      cameraControls.theta = 0;
      break;
  }
  cameraControls.update();
}

// --- 2D <-> 3D Conversions ---

function project3DTo2D(point3D) {
  const local = point3D.clone().sub(currentBasis.origin);
  return new THREE.Vector2(
    local.dot(currentBasis.u),
    local.dot(currentBasis.v)
  );
}

function project2DTo3D(point2D) {
  return currentBasis.origin.clone()
    .addScaledVector(currentBasis.u, point2D.x)
    .addScaledVector(currentBasis.v, point2D.y);
}

// --- Session Controls ---

export function isSketchActive() {
  return active;
}

export function startSketch(planeName = 'xz', offset = 0) {
  if (active) cancelSketch();

  active = true;
  points3D = [];
  points2D = [];

  setSketchPlane(planeName, offset);
  alignCameraToPlane(planeName);

  initPreviewLine();
  addEventListeners();
}

export function finishSketch() {
  if (!active) return null;

  if (points2D.length < 3) {
    alert("A closed profile requires at least 3 points.");
    cancelSketch();
    return null;
  }

  const resultData = {
    points2D: [...points2D],
    basis: {
      u: currentBasis.u.clone(),
      v: currentBasis.v.clone(),
      normal: currentBasis.normal.clone(),
      origin: currentBasis.origin.clone()
    },
    planeName: currentPlaneName
  };

  cleanup();
  return resultData;
}

export function cancelSketch() {
  cleanup();
}

export function undoLastPoint() {
  if (!active || points3D.length === 0) return;

  points3D.pop();
  points2D.pop();

  const marker = pointMarkers.pop();
  if (marker) scene.remove(marker);

  updatePreviewLine();
}

function cleanup() {
  active = false;
  cameraControls.active = true;

  removeEventListeners();

  if (previewLine) {
    scene.remove(previewLine);
    previewLine.geometry.dispose();
    previewLine.material.dispose();
    previewLine = null;
  }

  pointMarkers.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  pointMarkers = [];
}

// --- Raycasting & Drawing Events ---

function getIntersectionPoint(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const target = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(sketchPlane, target)) {
    return target;
  }
  return null;
}

function onPointerMove(event) {
  if (!active) return;

  const hitPoint = getIntersectionPoint(event);
  if (!hitPoint) return;

  hoverPoint = hitPoint;

  // Snap to start point if close enough
  if (points3D.length > 2) {
    const startPoint = points3D[0];
    if (hitPoint.distanceTo(startPoint) < SNAP_THRESHOLD_WORLD) {
      hoverPoint = startPoint.clone();
    }
  }

  updatePreviewLine(hoverPoint);
}

function onPointerDown(event) {
  if (!active || event.button !== 0) return;

  const hitPoint = getIntersectionPoint(event);
  if (!hitPoint) return;

  // Auto-finish loop if clicking back near start point
  if (points3D.length > 2) {
    const startPoint = points3D[0];
    if (hitPoint.distanceTo(startPoint) < SNAP_THRESHOLD_WORLD) {
      document.dispatchEvent(new CustomEvent('sketch-request-finish'));
      return;
    }
  }

  // Add new point
  points3D.push(hitPoint.clone());
  points2D.push(project3DTo2D(hitPoint));

  addPointMarker(hitPoint);
  updatePreviewLine();
}

// --- Visual Helpers ---

function initPreviewLine() {
  const geom = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({ 
    color: 0x00aaff, 
    linewidth: 2,
    depthTest: false,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    polygonOffsetUnits: -10
  });
  previewLine = new THREE.Line(geom, mat);
  previewLine.renderOrder = 10;
  scene.add(previewLine);
}

function updatePreviewLine(cursorPoint = null) {
  if (!previewLine) return;

  const linePoints = [...points3D];
  if (cursorPoint) linePoints.push(cursorPoint);

  if (previewLine.geometry) {
    previewLine.geometry.dispose();
  }

  previewLine.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
}

function addPointMarker(point3D) {
  const geom = new THREE.SphereGeometry(0.3, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ 
    color: points3D.length === 1 ? 0xff0055 : 0x00ffff,
    depthTest: false
  });
  const sphere = new THREE.Mesh(geom, mat);
  sphere.renderOrder = 11;
  sphere.position.copy(point3D);
  scene.add(sphere);
  pointMarkers.push(sphere);
}

function addEventListeners() {
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
}

function removeEventListeners() {
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerdown', onPointerDown);
}

// --- Geometry Construction & Mesh Generation ---

/**
 * Builds a visual line representation of a saved 2D sketch profile.
 */
export function buildSketchLine(points2DArray, basis, name = 'Sketch') {
  const shapePoints = points2DArray.map((p) => {
    return basis.origin.clone()
      .addScaledVector(basis.u, p.x)
      .addScaledVector(basis.v, p.y);
  });

  if (shapePoints.length > 0) {
    shapePoints.push(shapePoints[0].clone()); // Close loop if necessary
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(shapePoints);
  const material = new THREE.LineBasicMaterial({ 
    color: 0x00e1ff, 
    linewidth: 3,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5
  });
  
  const lineMesh = new THREE.Line(geometry, material);
  lineMesh.renderOrder = 10;

  lineMesh.name = name;
  
  // --- ATTACH SKETCH METADATA DIRECTLY TO THE MESH ---
  lineMesh.userData = {
    ...lineMesh.userData,
    isSketch: true,
    points2D: points2DArray,
    basis: {
      u: basis.u.clone(),
      v: basis.v.clone(),
      normal: basis.normal.clone(),
      origin: basis.origin.clone()
    }
  };

  // Register line object in scene objects set and auto-select
  instantiateObject(lineMesh, name, true);

  return lineMesh;
}

/**
 * Extrudes a 2D sketch profile along its plane normal into a 3D Mesh.
 */
export function extrudeSketchMesh(points2DArray, basis, depth = 10, symmetric = false) {
  const shape = new THREE.Shape();

  points2DArray.forEach((pt, idx) => {
    if (idx === 0) shape.moveTo(pt.x, pt.y);
    else shape.lineTo(pt.x, pt.y);
  });
  shape.closePath();

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  geometry.computeVertexNormals();

  const matrix = new THREE.Matrix4();
  const position = basis.origin.clone();

  if (symmetric) {
    position.addScaledVector(basis.normal, -depth / 2);
  }

  const rotationMatrix = new THREE.Matrix4().makeBasis(basis.u, basis.v, basis.normal);
  matrix.compose(position, new THREE.Quaternion().setFromRotationMatrix(rotationMatrix), new THREE.Vector3(1, 1, 1));

  geometry.applyMatrix4(matrix);

  const material = new THREE.MeshStandardMaterial({
    color: 0x44aa88,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material);
}