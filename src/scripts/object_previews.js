import * as THREE from 'three';
import { scene } from './camera.js';

const previewMaterial = new THREE.MeshStandardMaterial({ color: "#fbff92", transparent: true, opacity: 0.05 });

export function generateObjectPreview(mesh, pos, rot) {
    let i = 0;
    let tempName = mesh.name;
    while (scene.getObjectByName(tempName)) {
    i += 1;
    tempName = name + " " + i;
    }
    const clone = mesh.clone();
    clone.visible = true;
    clone.name = tempName;
    clone.material = previewMaterial;
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.getWorldPosition(worldPosition);
    mesh.getWorldQuaternion(worldQuaternion);
    mesh.getWorldScale(worldScale);
    clone.position.copy(worldPosition);
    clone.quaternion.copy(worldQuaternion);
    clone.scale.copy(worldScale);
    scene.attach(clone);
    return clone;
}