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
let points3D = []; // World positions of each committed VERTEX
let points2D = []; // Local 2D coordinates of each committed VERTEX
// segmentTypes[i] describes how point[i-1] connects to point[i]:
//   null                                  - no incoming segment (only index 0)
//   { type: 'line' }                      - straight line
//   { type: 'arc', center: Vector2 }      - arc around a center point (origin of its radius)
//   { type: 'bezier', c1: Vector2, c2: Vector2 } - cubic bezier with 2 control points
let segmentTypes = [];
let currentBasis = { u: new THREE.Vector3(), v: new THREE.Vector3(), normal: new THREE.Vector3(), origin: new THREE.Vector3() };

// Drawing mode & in-progress curve state
let drawMode = 'line'; // 'line' | 'arc' | 'bezier' | 'fillet'
let pendingCurvePoints = []; // Vector2[] - intermediate clicks for the current arc/bezier segment
let filletTargetIndex = null; // Index of the vertex currently selected for filleting
let draggingPointIndex = null; // Index of the vertex currently being dragged, if any
// True once the loop has been explicitly closed (click near the start point, or
// right-click). The preview then permanently shows the closing segment instead of a
// live rubber-band to the cursor - committing a new point (see commitPoint) reopens it.
let pathClosed = false;

// Set when re-entering an already-finished sketch to edit it (see editSketch()). Null
// for a brand-new sketch session.
let editingSketchRef = null;

// Visual Helpers
let previewLine = null;
let filletPreviewLine = null; // Separate, distinctly-colored preview for a pending fillet
let pointMarkers = [];
let hoverPoint = null;
const SNAP_THRESHOLD_WORLD = 1.0; // Distance to snap to start point
const CURVE_SAMPLES = 24; // Points used to render/flatten each arc or bezier segment

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

// --- Curve math (shared by preview rendering, extrude, and revolve) ---

function normalizeAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

/**
 * Given a center point (the origin of the arc's radius), a start point, and an end point,
 * computes the circle (radius = distance from center to start) and the angles/sweep
 * direction from start to end. The end point doesn't need to lie exactly on that circle -
 * only its angle relative to the center is used, so callers that need the actual curve
 * endpoint should project it via pointOnArc() below. Returns null if center coincides
 * with start (zero radius).
 */
function computeArcFromCenterStartEnd(center, start, end) {
  const radius = start.distanceTo(center);
  if (radius < 1e-6) return null;

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  // Always sweep the shorter way around by default (< 180°). This is also exactly
  // what a fillet's rounding arc needs - its sweep angle is always <= 180° by
  // construction, so this heuristic picks the correct side automatically.
  const clockwise = normalizeAngle(endAngle - startAngle) > Math.PI;

  return { cx: center.x, cy: center.y, radius, startAngle, endAngle, clockwise };
}

/**
 * Projects a point onto the arc's circle (same angle from center, but exactly `radius`
 * away) - used so a committed arc vertex always lies precisely on the curve it defines,
 * even if the user's click wasn't pixel-perfect on the circle.
 */
function pointOnArc(center, radius, throughPoint) {
  const angle = Math.atan2(throughPoint.y - center.y, throughPoint.x - center.x);
  return new THREE.Vector2(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
}

/**
 * Samples a single segment (start -> end, using the given descriptor) into an array of
 * Vector2 points, EXCLUDING the start point and INCLUDING the end point. Straight lines
 * just return [end]; curves are sampled via three.js's own curve classes.
 */
function sampleSegment2D(start2D, end2D, seg, numSamples = CURVE_SAMPLES) {
  if (seg && seg.type === 'arc' && seg.center) {
    const arc = computeArcFromCenterStartEnd(seg.center, start2D, end2D);
    if (arc) {
      const curve = new THREE.EllipseCurve(arc.cx, arc.cy, arc.radius, arc.radius, arc.startAngle, arc.endAngle, arc.clockwise, 0);
      return curve.getPoints(numSamples).slice(1);
    }
    // Degenerate (zero-radius) arc - fall through to a straight line.
  }
  if (seg && seg.type === 'bezier' && seg.c1 && seg.c2) {
    const curve = new THREE.CubicBezierCurve(start2D, seg.c1, seg.c2, end2D);
    return curve.getPoints(numSamples).slice(1);
  }
  return [end2D.clone()];
}

/**
 * Flattens a vertex list + segment descriptors into a dense polyline (Vector2[]) by
 * sampling any curved segments. Used for rendering, and for revolve's Lathe profile,
 * which can only work with a plain point list.
 *
 * When closeLoop is true, also samples the wraparound closing edge (last point back to
 * the first) using curveSegments[0] - the same slot that's otherwise unused, since a
 * segment "ending at" the first point only makes sense once the loop wraps around.
 */
export function flattenSegmentsToPoints2D(points2DArray, curveSegments, closeLoop = false, numSamples = CURVE_SAMPLES) {
  if (!points2DArray || points2DArray.length === 0) return [];
  const n = points2DArray.length;
  const flat = [points2DArray[0].clone()];

  for (let i = 1; i < n; i++) {
    const seg = (curveSegments && curveSegments[i]) || { type: 'line' };
    flat.push(...sampleSegment2D(points2DArray[i - 1], points2DArray[i], seg, numSamples));
  }

  if (closeLoop && n > 1) {
    const closingSeg = (curveSegments && curveSegments[0]) || { type: 'line' };
    flat.push(...sampleSegment2D(points2DArray[n - 1], points2DArray[0], closingSeg, numSamples));
  }

  return flat;
}

/**
 * Builds a THREE.Shape from a vertex list + segment descriptors, using true curve
 * primitives (absarc / bezierCurveTo) rather than a sampled approximation - used for
 * extrude, where geometry quality matters most. closeLoop works the same way as in
 * flattenSegmentsToPoints2D above.
 */
function buildShapeFromSegments(points2DArray, curveSegments, closeLoop = true) {
  const shape = new THREE.Shape();
  if (!points2DArray || points2DArray.length === 0) return shape;

  const n = points2DArray.length;
  shape.moveTo(points2DArray[0].x, points2DArray[0].y);

  const stepCount = closeLoop ? n : n - 1; // closeLoop adds one more step: last point -> first

  for (let step = 1; step <= stepCount; step++) {
    const i = step % n; // wraps to 0 on the final closing step
    const start = points2DArray[step - 1];
    const end = points2DArray[i];
    const seg = (curveSegments && curveSegments[i]) || { type: 'line' };

    if (seg.type === 'arc' && seg.center) {
      const arc = computeArcFromCenterStartEnd(seg.center, start, end);
      if (arc) {
        shape.absarc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle, arc.clockwise);
        continue;
      }
    }
    if (seg.type === 'bezier' && seg.c1 && seg.c2) {
      shape.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, end.x, end.y);
      continue;
    }
    shape.lineTo(end.x, end.y);
  }

  return shape;
}

/**
 * Deep-clones a curveSegments array (including its Vector2 control points), the same
 * way basis vectors get cloned when stored/restored - so stored userData never shares
 * mutable Vector2 references with the live sketching session.
 */
export function cloneCurveSegments(curveSegments) {
  if (!curveSegments) return curveSegments;
  return curveSegments.map((seg) => {
    if (!seg) return seg;
    const clone = { type: seg.type };
    if (seg.center) clone.center = seg.center.clone();
    if (seg.c1) clone.c1 = seg.c1.clone();
    if (seg.c2) clone.c2 = seg.c2.clone();
    return clone;
  });
}

/**
 * Computes the two tangent points and the "via" point of the rounding arc for filleting
 * the corner at cornerPt (between prevPt and nextPt) with the given radius. Returns null
 * if the corner is straight/degenerate or the radius doesn't fit within the segments.
 */
function computeFilletReplacement(prevPt, cornerPt, nextPt, radius) {
  const v1 = new THREE.Vector2().subVectors(prevPt, cornerPt);
  const v2 = new THREE.Vector2().subVectors(nextPt, cornerPt);
  const len1 = v1.length();
  const len2 = v2.length();
  if (len1 < 1e-6 || len2 < 1e-6 || radius <= 0) return null;

  const dir1 = v1.clone().normalize();
  const dir2 = v2.clone().normalize();

  const angle = Math.acos(THREE.MathUtils.clamp(dir1.dot(dir2), -1, 1));
  if (angle < 1e-3 || Math.abs(angle - Math.PI) < 1e-3) return null; // Straight or fully folded-back - nothing to round

  const tangentDist = radius / Math.tan(angle / 2);
  if (tangentDist > len1 || tangentDist > len2) return null; // Radius too big for these segment lengths

  const tangentStart = cornerPt.clone().addScaledVector(dir1, tangentDist);
  const tangentEnd = cornerPt.clone().addScaledVector(dir2, tangentDist);

  const bisector = dir1.clone().add(dir2).normalize();
  const centerDist = radius / Math.sin(angle / 2);
  const center = cornerPt.clone().addScaledVector(bisector, centerDist);

  return { tangentStart, tangentEnd, center };
}

// --- Session Controls ---

export function isSketchActive() {
  return active;
}

export function isEditingExistingSketch() {
  return editingSketchRef !== null;
}

export function startSketch(planeName = 'xz', offset = 0) {
  if (active) cancelSketch();

  active = true;
  points3D = [];
  points2D = [];
  segmentTypes = [];
  pendingCurvePoints = [];
  filletTargetIndex = null;
  draggingPointIndex = null;
  pathClosed = false;
  editingSketchRef = null;

  setSketchPlane(planeName, offset);
  alignCameraToPlane(planeName);

  initPreviewLine();
  addEventListeners();
}

/**
 * Re-opens an already-finished sketch mesh for editing: its existing vertices are loaded
 * back in as draggable points, and you can keep adding new points/curves or fillet
 * existing corners. Call finishSketch() as usual when done - the returned data's
 * `editingMesh` field tells the caller this was an edit rather than a brand-new sketch.
 */
export function editSketch(existingMesh) {
  if (!existingMesh || !existingMesh.userData || !existingMesh.userData.isSketch) return false;
  if (active) cancelSketch();

  const { basis, points2D: storedPoints2D, curveSegments: storedSegments, planeName } = existingMesh.userData;
  if (!basis || !storedPoints2D) return false;

  active = true;
  currentBasis = {
    u: basis.u.clone(),
    v: basis.v.clone(),
    normal: basis.normal.clone(),
    origin: basis.origin.clone()
  };
  currentPlaneName = planeName || currentPlaneName;
  sketchPlane.setFromNormalAndCoplanarPoint(currentBasis.normal, currentBasis.origin);

  points2D = storedPoints2D.map((p) => p.clone());
  segmentTypes = storedSegments ? cloneCurveSegments(storedSegments) : points2D.map(() => null);
  points3D = points2D.map((p) => project2DTo3D(p));
  pendingCurvePoints = [];
  filletTargetIndex = null;
  draggingPointIndex = null;
  pathClosed = false;
  editingSketchRef = existingMesh;
  existingMesh.visible = false;

  alignCameraToPlane(currentPlaneName);
  initPreviewLine();
  points3D.forEach((p, i) => addPointMarker(p, i));
  updatePreviewLine();
  addEventListeners();
  return true;
}

export function finishSketch() {
  if (!active) return null;

  if (points2D.length < 3) {
    alert("A closed profile requires at least 3 points.");
    cancelSketch();
    return null;
  }

  const resultData = {
    points2D: points2D.map((p) => p.clone()),
    curveSegments: cloneCurveSegments(segmentTypes),
    basis: {
      u: currentBasis.u.clone(),
      v: currentBasis.v.clone(),
      normal: currentBasis.normal.clone(),
      origin: currentBasis.origin.clone()
    },
    planeName: currentPlaneName,
    // Null for a brand-new sketch, or the original mesh if this session came from editSketch().
    editingMesh: editingSketchRef
  };

  cleanup();
  return resultData;
}

export function cancelSketch() {
  cleanup();
}

export function undoLastPoint() {
  if (!active) return;

  // Closing the loop is its own reversible step - undo that first before touching
  // any actual points.
  if (pathClosed) {
    pathClosed = false;
    updatePreviewLine();
    return;
  }

  // If mid-way through placing a curve's control points, step back through those first.
  if (pendingCurvePoints.length > 0) {
    pendingCurvePoints.pop();
    updatePreviewLine();
    return;
  }

  if (points3D.length === 0) return;

  points3D.pop();
  points2D.pop();
  segmentTypes.pop();

  const marker = pointMarkers.pop();
  if (marker) {
    scene.remove(marker);
    marker.geometry.dispose();
    marker.material.dispose();
  }

  updatePreviewLine();
}

function cleanup() {
  active = false;
  cameraControls.active = true;

  if (editingSketchRef) {
    editingSketchRef.visible = true;
  }
  editingSketchRef = null;
  pendingCurvePoints = [];
  filletTargetIndex = null;
  draggingPointIndex = null;
  pathClosed = false;

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

  if (filletPreviewLine) {
    scene.remove(filletPreviewLine);
    filletPreviewLine.geometry.dispose();
    filletPreviewLine.material.dispose();
    filletPreviewLine = null;
  }

  pointMarkers.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  pointMarkers = [];
}

// --- Draw mode & fillet controls ---

export function setDrawMode(mode) {
  const normalized = ['line', 'arc', 'bezier', 'fillet'].includes(mode) ? mode : 'line';
  if (normalized === drawMode) return; // No actual change - don't cancel an in-progress curve
                                        // just because some unrelated panel field was edited.
  drawMode = normalized;
  pendingCurvePoints = [];
  if (drawMode !== 'fillet') {
    filletTargetIndex = null;
    clearFilletPreview();
  }
  refreshMarkerHighlights();
  updatePreviewLine();
}

export function getDrawMode() {
  return drawMode;
}

export function getFilletTargetIndex() {
  return filletTargetIndex;
}

function selectFilletTarget(index) {
  // Any vertex can be filleted now, including the origin point (index 0) and the point
  // before it - the loop is always implicitly closed, so the wraparound edge connecting
  // them is a real segment (see curveSegments[0]), not a gap.
  filletTargetIndex = (points2D.length > 2 && index >= 0 && index < points2D.length) ? index : null;
  refreshMarkerHighlights();
  // Let the UI know a new target was picked, so it can refresh the fillet preview
  // using whatever radius is currently entered.
  document.dispatchEvent(new CustomEvent('sketch-fillet-target-changed'));
}

/**
 * Applies a fillet of the given radius to whichever vertex was last selected via
 * selectFilletTarget() (click a vertex while in Fillet draw mode). Returns false without
 * changing anything if there's no valid target, the adjacent segments aren't both
 * straight lines, or the radius doesn't fit.
 */
export function applyFillet(radius) {
  if (filletTargetIndex === null) return false;
  const index = filletTargetIndex;
  const n = points2D.length;
  if (n < 3) return false;

  const prevIndex = (index - 1 + n) % n;
  const nextIndex = (index + 1) % n;

  const segBefore = segmentTypes[index] || { type: 'line' };      // edge ending at `index`
  const segAfter = segmentTypes[nextIndex] || { type: 'line' };   // edge ending at `nextIndex`
  if (segBefore.type !== 'line' || segAfter.type !== 'line') return false;

  const prevPt = points2D[prevIndex];
  const cornerPt = points2D[index];
  const nextPt = points2D[nextIndex];

  const result = computeFilletReplacement(prevPt, cornerPt, nextPt, radius);
  if (!result) return false;

  const arcSeg = { type: 'arc', center: result.center };

  if (index === 0) {
    // Wraparound corner at the origin point - the array is re-rooted so the new
    // "tangentEnd" point becomes index 0, and "tangentStart" becomes the new last
    // point, with the arc as the new wraparound closing edge (index 0's slot).
    points2D = [result.tangentEnd, ...points2D.slice(1), result.tangentStart];
    segmentTypes = [arcSeg, { type: 'line' }, ...segmentTypes.slice(2), { type: 'line' }];
  } else if (index === n - 1) {
    // Wraparound corner at the last point - symmetric to the index===0 case above.
    points2D = [...points2D.slice(0, n - 1), result.tangentStart, result.tangentEnd];
    segmentTypes = [{ type: 'line' }, ...segmentTypes.slice(1, n - 1), { type: 'line' }, arcSeg];
  } else {
    // Ordinary interior corner.
    points2D.splice(index, 1, result.tangentStart, result.tangentEnd);
    segmentTypes.splice(index, 1, { type: 'line' }, arcSeg);
  }

  filletTargetIndex = null;
  clearFilletPreview();
  rebuildVertexState();
  return true;
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

function getMarkerIndexUnderPointer(event) {
  if (pointMarkers.length === 0) return -1;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(pointMarkers, false);
  if (intersects.length === 0) return -1;
  return pointMarkers.indexOf(intersects[0].object);
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
// the ortho/alignment snapping below. Set to 0 via the editor controls to disable it.
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

// --- Smart Snapping (ortho lock + alignment-to-other-points) ---
// A single master toggle for both behaviors below - independent of grid snap, which
// has its own always-available on/off (via amount = 0).
let smartSnapEnabled = true;

export function setSmartSnapEnabled(enabled) {
  smartSnapEnabled = !!enabled;
}

export function getSmartSnapEnabled() {
  return smartSnapEnabled;
}

export let currentSnapTypes = [];

/**
 * Applies snapping logic to a candidate 2D point based on active points in the sketch.
 */
function applySnapping2D(candidate2D) {
  currentSnapTypes = [];

  // --- 0. GRID SNAPPING (applies first, independent of the Smart Snap toggle below) ---
  const snapped = snapToGrid2D(candidate2D);
  if (gridSnapAmount > 0 && (snapped.x !== candidate2D.x || snapped.y !== candidate2D.y)) {
    currentSnapTypes.push('# Grid');
  }

  if (!smartSnapEnabled || points2D.length === 0) {
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

/**
 * Snapping used while dragging an EXISTING vertex: grid snap + alignment against every
 * OTHER point (excluding itself). The "last point" ortho-lock from applySnapping2D
 * doesn't apply here - dragging an arbitrary vertex isn't about extending the last
 * segment, so that particular rule would just be confusing.
 */
function applyDragSnapping2D(candidate2D, excludeIndex) {
  currentSnapTypes = [];

  const snapped = snapToGrid2D(candidate2D);
  if (gridSnapAmount > 0 && (snapped.x !== candidate2D.x || snapped.y !== candidate2D.y)) {
    currentSnapTypes.push('# Grid');
  }

  if (!smartSnapEnabled) return snapped;

  let snapH = false;
  let snapV = false;

  for (let i = 0; i < points2D.length; i++) {
    if (i === excludeIndex) continue;
    const pt = points2D[i];

    if (!snapH && Math.abs(snapped.y - pt.y) < SNAP_ALIGNMENT_THRESHOLD_2D) {
      snapped.y = pt.y;
      snapH = true;
      currentSnapTypes.push(' Align H');
    }
    if (!snapV && Math.abs(snapped.x - pt.x) < SNAP_ALIGNMENT_THRESHOLD_2D) {
      snapped.x = pt.x;
      snapV = true;
      currentSnapTypes.push(' Align V');
    }
  }

  return snapped;
}

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

function getModeHintLabel() {
  if (drawMode === 'arc') {
    return pendingCurvePoints.length === 0 ? ' | Click: arc center' : ' | Click: arc end-point';
  }
  if (drawMode === 'bezier') {
    if (pendingCurvePoints.length === 0) return ' | Click: control 1';
    if (pendingCurvePoints.length === 1) return ' | Click: control 2';
    return ' | Click: end-point';
  }
  return '';
}

function onPointerMove(event) {
  if (!active) return;

  // --- Dragging an existing vertex ---
  if (draggingPointIndex !== null) {
    const hitPoint = getIntersectionPoint(event);
    if (!hitPoint) return;

    let candidate2D = project3DTo2D(hitPoint);
    candidate2D = applyDragSnapping2D(candidate2D, draggingPointIndex);

    points2D[draggingPointIndex] = candidate2D;
    const newPoint3D = project2DTo3D(candidate2D);
    points3D[draggingPointIndex] = newPoint3D;
    if (pointMarkers[draggingPointIndex]) {
      pointMarkers[draggingPointIndex].position.copy(newPoint3D);
    }
    updatePreviewLine();

    if (snapIndicator) {
      snapIndicator.textContent = currentSnapTypes.length > 0 ? currentSnapTypes.join(' | ') : 'Editing point';
      snapIndicator.style.left = `${event.clientX}px`;
      snapIndicator.style.top = `${event.clientY}px`;
      snapIndicator.style.display = 'block';
    }
    return;
  }

  const hitPoint = getIntersectionPoint(event);
  if (!hitPoint) {
    if (snapIndicator) snapIndicator.style.display = 'none';
    return;
  }

  // --- Fillet mode: just hovering/picking existing corners, no new-point preview ---
  if (drawMode === 'fillet') {
    if (snapIndicator) snapIndicator.style.display = 'none';
    return;
  }

  // --- Loop already closed: preview is frozen showing the closed shape until a click
  // reopens it (see commitPoint/onContextMenu) - nothing to recompute here.
  if (pathClosed) {
    if (snapIndicator) {
      snapIndicator.textContent = '● Loop closed - click to add more, right-click to reopen';
      snapIndicator.style.left = `${event.clientX}px`;
      snapIndicator.style.top = `${event.clientY}px`;
      snapIndicator.style.display = 'block';
    }
    return;
  }

  // 1. Convert candidate 3D hit point to local 2D sketch coordinates
  let candidate2D = project3DTo2D(hitPoint);

  // 2. Check start-point snapping (closing loop) - only when not mid-way through a curve
  if (pendingCurvePoints.length === 0 && points3D.length > 2) {
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

  // 3. Apply Grid + Orthogonal + Alignment Snapping
  candidate2D = applySnapping2D(candidate2D);

  // 4. Project back to 3D world space
  hoverPoint = project2DTo3D(candidate2D);
  updatePreviewLine(hoverPoint);

  // 5. Update UI Indicator with Length + Snap Badges + current mode hint
  if (snapIndicator) {
    if (points3D.length > 0) {
      const lengthStr = getFormattedSegmentLength(hoverPoint);
      const modeLabel = getModeHintLabel();

      snapIndicator.textContent = currentSnapTypes.length > 0
        ? `${lengthStr} | ${currentSnapTypes.join(' | ')}${modeLabel}`
        : `${lengthStr}${modeLabel}`;

      snapIndicator.style.left = `${event.clientX}px`;
      snapIndicator.style.top = `${event.clientY}px`;
      snapIndicator.style.display = 'block';
    } else {
      snapIndicator.style.display = 'none';
    }
  }
}

function commitPoint(point2D, segmentDescriptor) {
  pathClosed = false; // Adding a point always reopens a previously-closed loop

  const point3D = project2DTo3D(point2D);
  points3D.push(point3D);
  points2D.push(point2D);
  segmentTypes.push(points2D.length === 1 ? null : segmentDescriptor);

  addPointMarker(point3D, points3D.length - 1);
  updatePreviewLine();
}

function onPointerDown(event) {
  if (!active || event.button !== 0) return;

  // --- Clicking an existing vertex: either select it for fillet, or start dragging it ---
  const markerIndex = getMarkerIndexUnderPointer(event);
  if (markerIndex !== -1) {
    if (drawMode === 'fillet') {
      selectFilletTarget(markerIndex);
    } else {
      draggingPointIndex = markerIndex;
    }
    return;
  }

  if (drawMode === 'fillet') return; // Fillet mode only picks existing corners, doesn't draw

  const hitPoint = getIntersectionPoint(event);
  if (!hitPoint) return;

  // Clicking back near the start point closes the loop: the preview permanently shows
  // the closing segment (no more rubber-band chasing the cursor) without auto-finishing
  // the sketch. The profile was already going to be treated as closed by every consumer
  // (buildSketchLine/extrude/revolve) regardless, so this is purely visual confirmation -
  // finish explicitly when ready, or place another point anywhere to reopen it.
  if (pendingCurvePoints.length === 0 && points3D.length > 2) {
    const startPoint = points3D[0];
    if (hitPoint.distanceTo(startPoint) < SNAP_THRESHOLD_WORLD) {
      pathClosed = true;
      updatePreviewLine();
      return;
    }
  }

  // Calculate local 2D point and apply snapping prior to adding it to state
  let snapped2D = project3DTo2D(hitPoint);
  snapped2D = applySnapping2D(snapped2D);

  if (drawMode === 'arc') {
    if (pendingCurvePoints.length === 0) {
      // First click sets the arc's center - the origin of its radius.
      pendingCurvePoints.push(snapped2D);
      updatePreviewLine();
      return;
    }
    const center = pendingCurvePoints[0];
    const arcStart = points2D[points2D.length - 1];
    const radius = arcStart.distanceTo(center);
    // Project the click onto the circle so the committed vertex lies exactly on the
    // curve it defines - otherwise the marker and the rendered arc would disagree.
    const projectedEnd = radius > 1e-6 ? pointOnArc(center, radius, snapped2D) : snapped2D;
    commitPoint(projectedEnd, { type: 'arc', center });
    pendingCurvePoints = [];
    return;
  }

  if (drawMode === 'bezier') {
    if (pendingCurvePoints.length < 2) {
      // First two clicks set the two cubic bezier control points.
      pendingCurvePoints.push(snapped2D);
      updatePreviewLine();
      return;
    }
    commitPoint(snapped2D, { type: 'bezier', c1: pendingCurvePoints[0], c2: pendingCurvePoints[1] });
    pendingCurvePoints = [];
    return;
  }

  // Default: straight line segment
  commitPoint(snapped2D, { type: 'line' });
}

function onPointerUp() {
  draggingPointIndex = null;
}

/**
 * Right-click cancels whatever's currently "in progress", in priority order: a curve
 * mid-way through its control-point clicks (arc center, bezier controls); a selected-
 * but-not-yet-applied fillet target; an already-closed loop (reopens it); or, as a
 * general "stop drawing" fallback, closes the loop early (same as clicking the start
 * point) so the rubber-band to the cursor goes away without needing to click back on
 * the exact start position. Suppresses the browser's context menu the whole time a
 * sketch is active, not just when there's something to cancel.
 */
function onContextMenu(event) {
  if (!active) return;
  event.preventDefault();

  if (pendingCurvePoints.length > 0) {
    pendingCurvePoints = [];
    updatePreviewLine();
    return;
  }

  if (filletTargetIndex !== null) {
    filletTargetIndex = null;
    refreshMarkerHighlights();
    clearFilletPreview();
    return;
  }

  if (pathClosed) {
    pathClosed = false;
    updatePreviewLine();
    return;
  }

  if (points2D.length > 2) {
    pathClosed = true;
    updatePreviewLine();
  }
}

function addEventListeners() {
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);
}

function removeEventListeners() {
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('contextmenu', onContextMenu);
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

  const filletMat = new THREE.LineBasicMaterial({
    color: 0xffaa00, // Distinct from the main (blue) preview line, matches the highlighted marker
    linewidth: 2,
    depthTest: false,
    polygonOffset: true,
    polygonOffsetFactor: -12,
    polygonOffsetUnits: -12
  });
  filletPreviewLine = new THREE.Line(new THREE.BufferGeometry(), filletMat);
  filletPreviewLine.renderOrder = 12;
  scene.add(filletPreviewLine);
}

function clearFilletPreview() {
  if (!filletPreviewLine) return;
  filletPreviewLine.geometry.dispose();
  filletPreviewLine.geometry = new THREE.BufferGeometry();
}

/**
 * Refreshes the fillet preview (a small overlay showing just the rounded replacement for
 * the selected corner, in a distinct color) for the currently selected fillet target.
 * Called live as the Fillet Radius input changes, and whenever a new target is picked.
 */
export function setFilletPreviewRadius(radius) {
  if (!filletPreviewLine) return;

  if (filletTargetIndex === null || !radius || radius <= 0) {
    clearFilletPreview();
    return;
  }

  const index = filletTargetIndex;
  const n = points2D.length;
  if (n < 3) {
    clearFilletPreview();
    return;
  }

  const prevIndex = (index - 1 + n) % n;
  const nextIndex = (index + 1) % n;

  const segBefore = segmentTypes[index] || { type: 'line' };
  const segAfter = segmentTypes[nextIndex] || { type: 'line' };
  if (segBefore.type !== 'line' || segAfter.type !== 'line') {
    clearFilletPreview();
    return;
  }

  const prevPt = points2D[prevIndex];
  const cornerPt = points2D[index];
  const nextPt = points2D[nextIndex];

  const result = computeFilletReplacement(prevPt, cornerPt, nextPt, radius);
  if (!result) {
    clearFilletPreview();
    return;
  }

  const arcPoints2D = sampleSegment2D(result.tangentStart, result.tangentEnd, { type: 'arc', center: result.center });
  const previewPoints2D = [prevPt, result.tangentStart, ...arcPoints2D, nextPt];
  const previewPoints3D = previewPoints2D.map((p) => project2DTo3D(p));

  filletPreviewLine.geometry.dispose();
  filletPreviewLine.geometry = new THREE.BufferGeometry().setFromPoints(previewPoints3D);
}

function updatePreviewLine(cursorPoint = null) {
  if (!previewLine) return;

  // Flatten all committed segments (sampling curves) into a dense render polyline.
  // closeLoop:pathClosed samples the wraparound closing edge too (curveSegments[0]) once
  // the loop has been explicitly closed, using whatever curve type it actually is -
  // e.g. an arc if the origin corner was filleted - not just a straight guess.
  const flat2D = flattenSegmentsToPoints2D(points2D, segmentTypes, pathClosed);
  const linePoints = flat2D.map((p) => project2DTo3D(p));

  if (!pathClosed && cursorPoint) {
    if (points2D.length === 0) {
      // Nothing placed yet - just a single point trailing the cursor as a guide.
      linePoints.push(cursorPoint);
    } else if (drawMode !== 'fillet') {
      const cursor2D = project3DTo2D(cursorPoint);
      const lastVertex2D = points2D[points2D.length - 1];

      let pendingSeg = null; // null = don't extend the preview - not enough info yet
                              // to show an accurate curve, so a straight guess would mislead.
      if (drawMode === 'line') {
        pendingSeg = { type: 'line' };
      } else if (drawMode === 'arc' && pendingCurvePoints.length === 1) {
        pendingSeg = { type: 'arc', center: pendingCurvePoints[0] };
      } else if (drawMode === 'bezier' && pendingCurvePoints.length === 2) {
        pendingSeg = { type: 'bezier', c1: pendingCurvePoints[0], c2: pendingCurvePoints[1] };
      }

      if (pendingSeg) {
        const sampled = sampleSegment2D(lastVertex2D, cursor2D, pendingSeg);
        sampled.forEach((p) => linePoints.push(project2DTo3D(p)));
      }
    }
  }

  if (previewLine.geometry) {
    previewLine.geometry.dispose();
  }

  previewLine.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
}

function refreshMarkerHighlights() {
  pointMarkers.forEach((m, i) => {
    m.material.color.set(i === filletTargetIndex ? 0xffaa00 : (i === 0 ? 0xff0055 : 0x00ffff));
  });
}

function addPointMarker(point3D, index) {
  const geom = new THREE.SphereGeometry(0.3, 12, 12);
  const color = index === filletTargetIndex ? 0xffaa00 : (index === 0 ? 0xff0055 : 0x00ffff);
  const mat = new THREE.MeshBasicMaterial({ 
    color,
    depthTest: false
  });
  const sphere = new THREE.Mesh(geom, mat);
  sphere.renderOrder = 11;
  sphere.position.copy(point3D);
  scene.add(sphere);
  pointMarkers.push(sphere);
}

/**
 * Rebuilds points3D + all vertex markers from the current points2D (and refreshes the
 * preview line). Used after structural edits that change the vertex count, like
 * applyFillet(), where markers can't just be moved in place.
 */
function rebuildVertexState() {
  points3D = points2D.map((p) => project2DTo3D(p));

  pointMarkers.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  pointMarkers = [];
  points3D.forEach((p, i) => addPointMarker(p, i));

  updatePreviewLine();
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
 * Builds a visual line representation of a saved 2D sketch profile. curveSegments
 * describes how each vertex connects to the previous one (line/arc/bezier) - see the
 * segmentTypes comment above for the shape of each entry.
 */
export function buildSketchLine(points2DArray, basis, curveSegments, name = 'Sketch') {
  // closeLoop:true samples the wraparound closing edge (curveSegments[0]) too, so a
  // filleted/curved origin corner renders correctly instead of a straight line jump.
  const flatPoints2D = flattenSegmentsToPoints2D(points2DArray, curveSegments, true);

  const shapePoints = flatPoints2D.map((p) => {
    return basis.origin.clone()
      .addScaledVector(basis.u, p.x)
      .addScaledVector(basis.v, p.y);
  });

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
    // Vertices are baked to absolute world coordinates (see above) with an identity
    // object transform - the transform-controls system needs to know this so it bakes
    // moves/scales/rotations into the geometry too, instead of into position/rotation/scale.
    bakedWorldGeometry: true,
    points2D: points2DArray,
    curveSegments: cloneCurveSegments(curveSegments),
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
 * Extrudes a 2D sketch profile along its plane normal into a 3D Mesh. curveSegments
 * (see buildSketchLine) lets arc/bezier segments extrude as true curves rather than
 * a faceted polyline approximation.
 */
export function extrudeSketchMesh(points2DArray, basis, curveSegments, depth = 10, symmetric = false) {
  const shape = buildShapeFromSegments(points2DArray, curveSegments);
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

  const mesh = new THREE.Mesh(geometry, material);
  // Vertices are baked to absolute world coordinates above, with an identity object
  // transform - flag this so the transform-controls system bakes any later move/scale/
  // rotate into the geometry too, instead of into position/rotation/scale.
  mesh.userData.bakedWorldGeometry = true;
  return mesh;
}

/**
 * Revolves a 2D sketch profile around the sketch plane's vertical (v) axis to build a
 * solid of revolution, the same way THREE.LatheGeometry treats a profile's x-coordinate
 * as a radius and its y-coordinate as height along the rotation axis. curveSegments
 * (see buildSketchLine) is flattened into a sampled polyline first, since Lathe can only
 * work with a plain point list.
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
export function revolveSketchMesh(points2DArray, basis, curveSegments, angleDeg = 360, radialSegments = 64) {
  const FULL_CIRCLE_DEG = 360;
  const isFullRevolve = angleDeg >= FULL_CIRCLE_DEG - 1e-3;
  const angleRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg, 0.01, FULL_CIRCLE_DEG));

  // LatheGeometry expects (radius, height) pairs - sketch x becomes radius, y becomes height.
  const flatPoints2D = flattenSegmentsToPoints2D(points2DArray, curveSegments);
  const lathePoints = flatPoints2D.map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));

  const geometries = [
    new THREE.LatheGeometry(lathePoints, radialSegments, 0, isFullRevolve ? Math.PI * 2 : angleRad)
  ];

  // A partial revolve leaves the original profile exposed at phi=0 and phi=angleRad;
  // cap those openings so the solid doesn't end up with a hole through it.
  if (!isFullRevolve) {
    const shape = buildShapeFromSegments(points2DArray, curveSegments);
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

  const mesh = new THREE.Mesh(geometry, material);
  // Vertices are baked to absolute world coordinates above, with an identity object
  // transform - flag this so the transform-controls system bakes any later move/scale/
  // rotate into the geometry too, instead of into position/rotation/scale.
  mesh.userData.bakedWorldGeometry = true;
  return mesh;
}
