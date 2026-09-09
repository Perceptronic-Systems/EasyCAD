// NOTE: this file was not part of the original codebase provided to me - cad_tools.js
// imports it (`generateObjectPreview`) for its circular/rectangular pattern previews,
// but the actual source was never shared. This is a reasonable reconstruction based on
// how it's called (clone a mesh, mark it as a non-interactive preview, ghost it visually)
// and how preview meshes are treated elsewhere in this codebase (semi-transparent,
// tagged 'preview', excluded from selection/raycasting since objects.has(name) gates
// that). Replace with the original file if you have it.
import * as THREE from 'three';

export function generateObjectPreview(mesh) {
  const clone = mesh.clone();

  // Previews share geometry (cheap, no edits happen to it) but need their own material
  // so ghosting one clone doesn't affect the source mesh or other previews.
  clone.material = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.clone())
    : mesh.material.clone();

  const applyGhostStyle = (material) => {
    material.transparent = true;
    material.opacity = 0.35;
    material.depthWrite = false;
  };

  if (Array.isArray(clone.material)) {
    clone.material.forEach(applyGhostStyle);
  } else {
    applyGhostStyle(clone.material);
  }

  clone.userData = { ...mesh.userData, tag: 'preview' };
  clone.castShadow = false;
  clone.receiveShadow = false;

  return clone;
}
