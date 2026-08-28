import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  
  // Hide UI indicator
  if (snapIndicator) {
    snapIndicator.style.display = 'none';
  }

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

function getFormattedSegmentLength(hoverPoint) {
  if (points3D.length === 0) return '';

  const lastPoint = points3D[points3D.length - 1];
  const distance = lastPoint.distanceTo(hoverPoint);

  // Formats to 2 decimal places (e.g. "12.50 units")
  return `${distance.toFixed(2)}`;
}

// Add alignment threshold (in 2D plane units)
const SNAP_ALIGNMENT_THRESHOLD_2D = 0.5; // Snap horizontal/vertical if within 0.5 units

// --- Grid Snapping ---
// Snaps every sketch point to the nearest multiple of this amount (in mm), on top of
// the existing ortho/alignment snapping below. Set to 0 via the editor controls to disable it.
let gridSnapAmount = 1; // Default: snap per 1mm

export function setGridSnapAmount(amount) {
  gridSnapAmount = Number(amount) || 0;
}

export function getGridSnapAmount() {
  return gridSnapAmount;
}

function snapToGrid2D(point2D) {
  if (!gridSnapAmount || gridSnapAmount <= 0) return point2D.clone();
  return new THREE.Vector2(
    Math.round(point2D.x / gridSnapAmount) * gridSnapAmount,
    Math.round(point2D.y / gridSnapAmount) * gridSnapAmount
  );
}

/**
 * Applies snapping logic to a candidate 2D point based on active points in the sketch.
 */

const snapIndicator = document.createElement('div');
snapIndicator.id = 'snap-indicator';
snapIndicator.style.position = 'fixed';
snapIndicator.style.pointerEvents = 'none'; // Ensure mouse clicks pass through to canvas
snapIndicator.style.display = 'none';
snapIndicator.style.padding = '2px 6px';
snapIndicator.style.background = 'rgba(0, 170, 255, 0.9)';
snapIndicator.style.color = '#ffffff';
snapIndicator.style.fontSize = '11px';
snapIndicator.style.fontWeight = 'bold';
snapIndicator.style.borderRadius = '3px';
snapIndicator.style.zIndex = '1000';
snapIndicator.style.transform = 'translate(12px, 12px)'; // Offset slightly relative to cursor tip
document.body.appendChild(snapIndicator);

export let currentSnapTypes = [];

function applySnapping2D(candidate2D) {
  currentSnapTypes = [];

  // --- 0. GRID SNAPPING (applies first, in addition to ortho/alignment below) ---
  const snapped = snapToGrid2D(candidate2D);
  if (gridSnapAmount > 0 && (snapped.x !== candidate2D.x || snapped.y !== candidate2D.y)) {
    currentSnapTypes.push('# Grid');
  }

  if (points2D.length === 0) {
    return snapped;
  }

  const lastPoint = points2D[points2D.length - 1];

  let snapH = false; // Tracks if Y-coordinate is constrained
  let snapV = false; // Tracks if X-coordinate is constrained

  // --- 1. ORTHOGONAL SNAPPING (Relative to immediate last point) ---
  if (Math.abs(snapped.y - lastPoint.y) < SNAP_ALIGNMENT_THRESHOLD_2D) {
    snapped.y = lastPoint.y;
    snapH = true;
    currentSnapTypes.push('— Horizontal');
  }
  if (Math.abs(snapped.x - lastPoint.x) < SNAP_ALIGNMENT_THRESHOLD_2D) {
    snapped.x = lastPoint.x;
    snapV = true;
    currentSnapTypes.push('│ Vertical');
  }

  // --- 2. INLINE ALIGNMENT SNAPPING (Check against all previous points) ---
  for (let i = 0; i < points2D.length - 1; i++) {
    const pt = points2D[i];

    // If Y isn't locked horizontally by Ortho, check for inline Horizontal alignment
    if (!snapH && Math.abs(snapped.y - pt.y) < SNAP_ALIGNMENT_THRESHOLD_2D) {
      snapped.y = pt.y;
      snapH = true;
      currentSnapTypes.push(' Align H');
    }

    // If X isn't locked vertically by Ortho, check for inline Vertical alignment
    if (!snapV && Math.abs(snapped.x - pt.x) < SNAP_ALIGNMENT_THRESHOLD_2D) {
      snapped.x = pt.x;
      snapV = true;
      currentSnapTypes.push(' Align V');
    }
  }

  return snapped;
}

function onPointerMove(event) {
  if (!active) return;

  const hitPoint = getIntersectionPoint(event);
  if (!hitPoint) {
    if (snapIndicator) snapIndicator.style.display = 'none';
    return;
  }

  // 1. Convert candidate 3D hit point to local 2D sketch coordinates
  let candidate2D = project3DTo2D(hitPoint);

  // 2. Check start-point snapping (closing loop)
  if (points3D.length > 2) {
    const startPoint = points3D[0];
    if (hitPoint.distanceTo(startPoint) < SNAP_THRESHOLD_WORLD) {
      hoverPoint = startPoint.clone();
      updatePreviewLine(hoverPoint);

      if (snapIndicator) {
        const lengthStr = getFormattedSegmentLength(hoverPoint);
        snapIndicator.textContent = `● Close Loop (${lengthStr})`;
        snapIndicator.style.left = `${event.clientX}px`;
        snapIndicator.style.top = `${event.clientY}px`;
        snapIndicator.style.display = 'block';
      }
      return;
    }
  }

  // 3. Apply Orthogonal & Alignment Snapping
  candidate2D = applySnapping2D(candidate2D);

  // 4. Project back to 3D world space
  hoverPoint = project2DTo3D(candidate2D);
  updatePreviewLine(hoverPoint);

  // 5. Update UI Indicator with Length + Snap Badges
  if (snapIndicator) {
    if (points3D.length > 0) {
      const lengthStr = getFormattedSegmentLength(hoverPoint);
      
      // Combine length with snap labels if any exist
      if (currentSnapTypes.length > 0) {
        snapIndicator.textContent = `${lengthStr} | ${currentSnapTypes.join(' | ')}`;
      } else {
        snapIndicator.textContent = lengthStr;
      }

      snapIndicator.style.left = `${event.clientX}px`;
      snapIndicator.style.top = `${event.clientY}px`;
      snapIndicator.style.display = 'block';
    } else {
      snapIndicator.style.display = 'none';
    }
  }
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

  // Calculate local 2D point and apply snapping prior to adding it to state
  let snapped2D = project3DTo2D(hitPoint);
  snapped2D = applySnapping2D(snapped2D);

  const final3DPoint = project2DTo3D(snapped2D);

  // Add snapped points to active state
  points3D.push(final3DPoint);
  points2D.push(snapped2D);

  addPointMarker(final3DPoint);
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
 * The basis stored in a sketch mesh's userData is frozen at the moment the sketch was
 * created - it never accounts for any move/rotate/scale later applied to the sketch
 * mesh itself (e.g. via the transform controls). This computes the *effective* basis,
 * folding the mesh's current matrixWorld into the original u/v/normal/origin so that
 * extrude/revolve results (and previews) reflect whatever transform is currently applied
 * to the sketch, exactly as it appears on screen.
 */
export function getWorldBasis(sketchMesh) {
  const { basis } = sketchMesh.userData;
  // The sketch may currently be parented under the transform controls' selection group,
  // so refresh the whole graph rather than just this mesh to make sure its matrixWorld
  // reflects the group's latest position/rotation/scale too.
  scene.updateMatrixWorld(true);
  const matrixWorld = sketchMesh.matrixWorld;

  // Linear part only (rotation + scale, no translation) - correct for transforming
  // direction/basis vectors, as opposed to points which also need translation.
  const linear = new THREE.Matrix3().setFromMatrix4(matrixWorld);

  return {
    u: basis.u.clone().applyMatrix3(linear),
    v: basis.v.clone().applyMatrix3(linear),
    normal: basis.normal.clone().applyMatrix3(linear),
    origin: basis.origin.clone().applyMatrix4(matrixWorld)
  };
}

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
    depthTest: false,   // Prevents reference planes/images from obscuring the line
    depthWrite: false,  // Ensures line drawing layer doesn't compete in depth buffer
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5
  });
  
  const lineMesh = new THREE.Line(geometry, material);
  lineMesh.renderOrder = 10; // Ensures it renders after regular geometry

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

  const position = basis.origin.clone();

  if (symmetric) {
    position.addScaledVector(basis.normal, -depth / 2);
  }

  // Built directly from the basis vectors (not via a quaternion) so that any scale
  // baked into u/v/normal - e.g. from a scaled sketch - is preserved rather than
  // normalized away.
  const matrix = new THREE.Matrix4().makeBasis(basis.u, basis.v, basis.normal);
  matrix.setPosition(position);

  geometry.applyMatrix4(matrix);

  const material = new THREE.MeshStandardMaterial({
    color: 0x44aa88,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Revolves a 2D sketch profile around the sketch plane's vertical (v) axis to build a
 * solid of revolution, the same way THREE.LatheGeometry treats a profile's x-coordinate
 * as a radius and its y-coordinate as height along the rotation axis.
 *
 * A full 360° revolve wraps the swept surface back into itself (identical to how
 * LatheGeometry naturally welds phi=0 to phi=2π), so no seam/cap faces are generated -
 * it becomes one continuous shape rather than two touching faces where the ends meet.
 * Any angle less than 360° leaves the profile exposed at both ends, so flat caps are
 * added there to keep the resulting solid closed.
 *
 * Note: sketch points are expected to have a non-negative x (radius) value, since a
 * profile that crosses the rotation axis would self-intersect when revolved.
 */
export function revolveSketchMesh(points2DArray, basis, angleDeg = 360, segments = 64) {
  const FULL_CIRCLE_DEG = 360;
  const isFullRevolve = angleDeg >= FULL_CIRCLE_DEG - 1e-3;
  const angleRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg, 0.01, FULL_CIRCLE_DEG));

  // LatheGeometry expects (radius, height) pairs - sketch x becomes radius, y becomes height.
  const lathePoints = points2DArray.map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));

  const geometries = [
    new THREE.LatheGeometry(lathePoints, segments, 0, isFullRevolve ? Math.PI * 2 : angleRad)
  ];

  // A partial revolve leaves the original profile exposed at phi=0 and phi=angleRad;
  // cap those openings so the solid doesn't end up with a hole through it.
  if (!isFullRevolve) {
    const shape = new THREE.Shape();
    points2DArray.forEach((pt, idx) => {
      if (idx === 0) shape.moveTo(pt.x, pt.y);
      else shape.lineTo(pt.x, pt.y);
    });
    shape.closePath();

    // ShapeGeometry builds the profile in the local XY plane (z=0). Rotating by -90° about
    // Y remaps that flat profile onto the lathe's phi=0 plane, where a point's radius (x)
    // maps to local Z instead of local X - matching LatheGeometry's own vertex placement.
    const startCap = new THREE.ShapeGeometry(shape);
    startCap.rotateY(-Math.PI / 2);
    geometries.push(startCap);

    const endCap = new THREE.ShapeGeometry(shape);
    endCap.rotateY(angleRad - Math.PI / 2);
    geometries.push(endCap);
  }

  const geometry = BufferGeometryUtils.mergeGeometries(geometries, false);
  geometry.computeVertexNormals();

  // Built directly from the basis vectors (not via a quaternion) so that any scale
  // baked into u/v/normal - e.g. from a scaled sketch - is preserved rather than
  // normalized away.
  const matrix = new THREE.Matrix4().makeBasis(basis.u, basis.v, basis.normal);
  matrix.setPosition(basis.origin);
  geometry.applyMatrix4(matrix);

  const material = new THREE.MeshStandardMaterial({
    color: 0x44aa88,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
    flatShading: true
  });

  return new THREE.Mesh(geometry, material);
}