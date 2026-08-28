import { scene, camera, renderer, cameraControls } from './camera.js';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const snap = {translation: 5.0, scale: 5.0, rotation: 15};

// Sets the size of the object in world units
export function setSize(group, X, Y, Z) {
  // 1. Force a matrix update so we get highly accurate current world sizes
  group.updateMatrixWorld(true);
  
  const size = getSize(group);
  
  // 2. Prevent division by zero if an object has no width/height/depth
  const scaleX = size.x === 0 ? 1 : (X / size.x) * group.scale.x;
  const scaleY = size.y === 0 ? 1 : (Y / size.y) * group.scale.y;
  const scaleZ = size.z === 0 ? 1 : (Z / size.z) * group.scale.z;
  
  group.scale.set(scaleX, scaleY, scaleZ);
}

// Returns the true current size of the object in world units
export function getSize(group) {
  // Save current rotation and scale
  const originalRotation = group.rotation.clone();
  
  // Clear rotation to get an axis-aligned bounding box of the geometry shape
  group.rotation.set(0, 0, 0);
  group.updateMatrixWorld(true); // Crucial: tell Three.js the rotation changed before measuring
  
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  // Restore original rotation
  group.rotation.copy(originalRotation);
  group.updateMatrixWorld(true);

  size.x = parseFloat(size.x.toFixed(2));
  size.y = parseFloat(size.y.toFixed(2));
  size.z = parseFloat(size.z.toFixed(2));
  
  // DO NOTa multiply by group.scale here. box.setFromObject already accounts for scale.
  return size;
}

export function updateSnap(group) {
  if (!transformControls) return;
  
  transformControls.setTranslationSnap(snap.translation);
  transformControls.scaleSnap = null; 
  
  // Ensure we pass group, and only snap when the user is actively scaling
  if (transformControls.mode === 'scale' && group) {
    scaleSnap(group);
  }
  
  transformControls.setRotationSnap((snap.rotation * (Math.PI / 180)) % (2 * Math.PI));
}

export function scaleSnap(group) {
  // To snap cleanly to world units, we need the "geometry size" if scale was 1,1,1
  const originalRotation = group.rotation.clone();
  const originalScale = group.scale.clone();
  
  // Reset both to get the raw, unscaled, unrotated base geometry size
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);
  group.updateMatrixWorld(true);
  
  const box = new THREE.Box3().setFromObject(group);
  const rawGeometrySize = new THREE.Vector3();
  box.getSize(rawGeometrySize);
  
  // Restore original states immediately so we don't disrupt the render
  group.rotation.copy(originalRotation);
  group.scale.copy(originalScale);
  group.updateMatrixWorld(true);

  // Now calculate the snapped target world size, and convert that back to a scale multiplier
  if (rawGeometrySize.x > 0) {
    const currentWorldX = originalScale.x * rawGeometrySize.x;
    const snappedWorldX = Math.round(currentWorldX / snap.scale) * snap.scale;
    group.scale.x = snappedWorldX / rawGeometrySize.x;
  }
  if (rawGeometrySize.y > 0) {
    const currentWorldY = originalScale.y * rawGeometrySize.y;
    const snappedWorldY = Math.round(currentWorldY / snap.scale) * snap.scale;
    group.scale.y = snappedWorldY / rawGeometrySize.y;
  }
  if (rawGeometrySize.z > 0) {
    const currentWorldZ = originalScale.z * rawGeometrySize.z;
    const snappedWorldZ = Math.round(currentWorldZ / snap.scale) * snap.scale;
    group.scale.z = snappedWorldZ / rawGeometrySize.z;
  }
}

export function clampDeg(degrees) {
  return (((degrees % 360) + 360) % 360).toFixed(2);
}

export function degToRad(degrees) {
  return clampRad(degrees * (Math.PI / 180));
}

export function clampRad(radians) {
  const twopi = 2 * Math.PI;
  return ((radians % twopi) + twopi) % twopi;
}

export function radToDeg(radians) {
  return clampDeg(radians * (180 / Math.PI));
}

// Transform Controls
export const transformControls = new TransformControls(camera, renderer.domElement);
const transformGizmo = transformControls.getHelper();
scene.add(transformGizmo);
const internalGizmo = transformGizmo.children[0];


transformControls.addEventListener('change', (e) => {
  const axis = transformControls.axis;
  const object = transformControls.object;
  let maxScale = 1;
  if (!object || !transformControls.dragging) return;

  if (transformControls.mode === "scale") {
    switch (axis) {
      case "XY":
        maxScale = Math.max(object.scale.x, object.scale.y);
        object.scale.set(maxScale, maxScale, object.scale.z);
        break;
      case "XZ":
        maxScale = Math.max(object.scale.x, object.scale.z);
        object.scale.set(maxScale, object.scale.y, maxScale);
        break;
      case "YZ":
        maxScale = Math.max(object.scale.y, object.scale.z);
        object.scale.set(object.scale.x, maxScale, maxScale);
        break;
      case "XYZ":
        maxScale = Math.max(object.scale.x, object.scale.y, object.scale.z);
        object.scale.set(maxScale, maxScale, maxScale);
        break;
    }
  }
})

transformControls.addEventListener('dragging-changed', (e) => {
    cameraControls.active = !e.value;
});

export function defineSelectionGroup(group, selectedObjects) {
  deactivateTransformControls();
  while (group.children.length > 0) {
    scene.attach(group.children[0]);
  };
  if (scene.getObjectByName('selection-group')) {
    scene.remove(group);
  }
  scene.add(group);
  let avgPos = new THREE.Vector3(0, 0, 0);
  //let avgScale = new THREE.Vector3(0, 0, 0);
  const avgQuat = new THREE.Quaternion(0, 0, 0, 0);
  const tempQuat = new THREE.Quaternion();
  const selection = Object.values(selectedObjects);
  const count = selection.length;
  if (count > 1) {
    group.scale.set(1, 1, 1);
    group.rotation.set(0, 0, 0);
  }

  selection.forEach(mesh => {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    avgPos.add(worldPos);

    if (count > 1) return;

    //const worldScale = new THREE.Vector3();
    //mesh.getWorldScale(worldScale);
    //avgScale.add(worldScale);
    
    mesh.getWorldQuaternion(tempQuat);
    if (avgQuat.dot(tempQuat) < 0) {
        tempQuat.set(-tempQuat.x, -tempQuat.y, -tempQ.z, -tempQuat.w);
    }

    avgQuat.x += tempQuat.x;
    avgQuat.y += tempQuat.y;
    avgQuat.z += tempQuat.z;
    avgQuat.w += tempQuat.w;
  })
  group.position.copy(avgPos.divideScalar(count));
  //avgScale = avgScale.divideScalar(count)
  if (count === 1) {
    //group.scale.copy(avgScale);
    //group.quaternion.copy(avgQuat.normalize());
  }

  selection.forEach(mesh => {
    group.attach(mesh);
  });
}

export function activateTransformControls(group, selectedObjects, mode) {
  try {
    defineSelectionGroup(group, selectedObjects);

    transformControls.setMode(mode);
    updateSnap(group);

    if (transformControls.mode === 'rotate') {
      const rotationE = internalGizmo.gizmo.rotate.getObjectByName('E');
      const pickerE = internalGizmo.picker.rotate.getObjectByName('E');

      if (rotationE) rotationE.visible = false;
      if (pickerE) pickerE.visible = false;

      Object.defineProperty(rotationE, 'visible', {
        get: () => false,
        set: () => {}, // Ignore attempts to set it to true
        configurable: true
      });

      Object.defineProperty(pickerE, 'visible', {
        get: () => false,
        set: () => {}, // Ignore attempts to set it to true
        configurable: true
      });
    }
    transformControls.attach(group);
  } catch (error) {
    console.log('An error occured when activating/assigning the transform controls');
    console.log(error);
  }
}
export function deactivateTransformControls() {
  if (transformControls) {
    transformControls.detach();
  }
}