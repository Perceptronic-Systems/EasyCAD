import { select } from 'three/tsl';
import { booleanOperation, instantiateObject, deleteObjects, createPrimitive, selectionGroup, selectedObjects, transformHelper, deselectObjects, selectObjects } from './cad_tools.js';
import { activateTransformControls, defineSelectionGroup, transformControls } from './transform_controls.js';
import { generateCircularPattern, generateRectangularPattern, activeTool, clipboard, createName } from './cad_tools.js';
import { scene } from './camera.js';
import * as THREE from 'three';

export let undoStack = [];
export let redoStack = [];

function getMesh(uuid) {
    return scene.getObjectByProperty('uuid', uuid);
}

function getMeshByName(name) {
    return scene.getObjectByName(name);
}

export function undo() {
    if (undoStack.length === 0) return;
    const command = undoStack.pop();
    console.log(`Undo: ${command.constructor.name}`);
    command.undo();
    defineSelectionGroup(selectionGroup, selectedObjects);
    transformHelper.update();
}

export function redo() {
  if (redoStack.length === 0) return;
  const command = redoStack.pop();
  console.log(`Redo: ${command.constructor.name}`);
  command.execute();
  undoStack.push(command);
  defineSelectionGroup(selectionGroup, selectedObjects);
  transformHelper.update();
}

let mouseDown = false;

transformControls.addEventListener('mouseDown', (e) => {
    if (mouseDown) return;
    const mesh = transformControls.object;
    mesh.userData.oldPos = mesh.position.clone();
    mesh.userData.oldScale = mesh.scale.clone();
    mesh.userData.oldRot = mesh.rotation.clone();
    mouseDown = true;
});

transformControls.addEventListener('mouseUp', (e) => {
    const mode = transformControls.getMode();
    defineSelectionGroup(selectionGroup, selectedObjects);
    activateTransformControls(selectionGroup, selectedObjects, mode);
    mouseDown = false;
    const userData = transformControls.object.userData;
    if (!userData.oldPos && !userData.oldScale && !userData.oldRot) return;
    if (transformControls.mode === 'translate') {
        undoStack.push(new setPosition(selectionGroup, userData.oldPos, selectionGroup.position.clone()));
    } else if (transformControls.mode === 'scale') {
        undoStack.push(new setScale(selectionGroup, userData.oldScale, selectionGroup.scale.clone()));
    } else if (transformControls.mode === 'rotate') {
        undoStack.push(new setRotation(selectionGroup, userData.oldRot, selectionGroup.rotation.clone()));
    }
});

export class addPrimitive {
    constructor(meshName, type, size, position) {
        this.meshName = meshName;
        this.type = type;
        this.size = size;
        this.position = position;
        this.mesh = null;
        this.savedUuid = null;
        this.execute();
    }

    execute() {
        if (!this.mesh) {
            this.mesh = createPrimitive(this.meshName, this.type, this.size, this.position);
            this.meshName = this.mesh.name;
            this.savedUuid = this.mesh.uuid;
        } else {
            const reconstructedMesh = createPrimitive(this.meshName, this.type, this.size, this.position);
            reconstructedMesh.uuid = this.savedUuid;
            this.mesh = reconstructedMesh;
            instantiateObject(this.mesh, this.meshName, true, false, true);
        }
    }

    undo() {
        deselectObjects();
        deleteObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class paste {
    constructor() {
        this.clipboard = Object.values(clipboard).map(mesh => mesh.clone());
        this.clipboard.forEach(mesh => mesh.material = mesh.material.clone());
        this.execute();
    }
    execute() {
        this.clipboard.forEach(mesh => instantiateObject(mesh, createName(mesh.name)));
    }
    undo() {
        deleteObjects(this.clipboard);
        redoStack.push(this);
    }
}

export class addObject {
    constructor(mesh, meshName, execute = true, uuid = null) {
        this.mesh = mesh.clone();
        this.mesh.material = mesh.material.clone();
        this.mesh.name = meshName;
        this.meshName = meshName;
        if (uuid) this.mesh.uuid = uuid;

        if (execute) this.execute();
    }

    execute() {
        instantiateObject(this.mesh, this.meshName);
    }

    undo() {
        this.savedUuid = this.mesh.uuid;
        deleteObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class removeObjects {
    constructor(meshes) {
        if (!meshes || meshes.length === 0) return;

        this.backupData = meshes.map(mesh => {
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();

            mesh.getWorldPosition(worldPosition);
            mesh.getWorldQuaternion(worldQuaternion);
            mesh.getWorldScale(worldScale);

            return {
                uuid: mesh.uuid, // capture true identity before any clone()
                meshClone: mesh.clone(),
                geometryClone: mesh.geometry.clone(),
                materialClone: mesh.material ? mesh.material.clone() : null,
                position: worldPosition,
                quaternion: worldQuaternion,
                scale: worldScale,
                name: mesh.name
            };
        });

        this.currentLiveMeshes = [...meshes]; // track the CURRENT live reference
        this.execute();
    }

    execute() {
        if (this.currentLiveMeshes && this.currentLiveMeshes.length > 0) {
            deleteObjects(this.currentLiveMeshes);
        }
    }

    undo() {
        const restoredMeshes = [];

        this.backupData.forEach(b => {
            try {
                const freshClone = b.meshClone.clone();
                freshClone.uuid = b.uuid; // force original identity back
                freshClone.geometry = b.geometryClone.clone();
                if (b.materialClone) freshClone.material = b.materialClone.clone();

                freshClone.position.copy(b.position);
                freshClone.quaternion.copy(b.quaternion);
                freshClone.scale.copy(b.scale);
                freshClone.children = [];

                instantiateObject(freshClone, b.name, false, true, true);
                restoredMeshes.push(freshClone);
            } catch (error) {
                console.error('An error occurred when re-creating the deleted object:', error);
            }
        });

        this.currentLiveMeshes = restoredMeshes; // keep execute()/redo() in sync
        if (restoredMeshes.length > 0) selectObjects(restoredMeshes);
        redoStack.push(this);
    }
}

export class setPosition {
    constructor(group, oldPos, newPos) {
        this.group = group;
        this.meshIDs = this.group.children.map(mesh => mesh.uuid);
        this.oldPos = oldPos;
        this.newPos = newPos;
        this.execute();
    }
    execute() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.position.copy(this.newPos);
    }
    undo() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.position.copy(this.oldPos);
        redoStack.push(this);
    }
}

export class setScale {
    constructor(group, oldScale, newScale) {
        this.group = group;
        this.meshIDs = this.group.children.map(mesh => mesh.uuid);
        this.oldScale = oldScale;
        this.newScale = newScale;
        this.execute();
    }
    execute() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.scale.copy(this.newScale);
    }
    undo() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.scale.copy(this.oldScale);
        redoStack.push(this);
    }
}

export class setRotation {
    constructor(group, oldRot, newRot) {
        this.group = group;
        this.meshIDs = this.group.children.map(mesh => mesh.uuid);
        this.oldRot = oldRot;
        this.newRot = newRot;
        this.execute();
    }
    execute() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.rotation.copy(this.newRot);
    }
    undo() {
        selectObjects(this.meshIDs.map(id => getMesh(id)));
        this.group.rotation.copy(this.oldRot);
        redoStack.push(this);
    }
}

export class combineObjects {
    constructor(meshes, operation, resultName) {
        if (!meshes) console.log('Error, cannot combine objects, meshes are missing!');
        this.backupData = meshes.map(mesh => {
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            mesh.getWorldPosition(worldPosition);
            mesh.getWorldQuaternion(worldQuaternion);
            mesh.getWorldScale(worldScale);

            return {
                uuid: mesh.uuid,
                meshClone: mesh.clone(),
                geometryClone: mesh.geometry.clone(),
                materialClone: mesh.material ? mesh.material.clone() : null,
                position: worldPosition,
                quaternion: worldQuaternion,
                scale: worldScale
            };
        });
        
        this.currentLiveMeshes = [...meshes];
        deselectObjects();
        this.operation = operation;
        this.resultName = resultName;
        this.execute();
    }

    execute() {
        if (this.currentLiveMeshes && this.currentLiveMeshes.length > 0) {
            deleteObjects(this.currentLiveMeshes);
            this.currentLiveMeshes = [];
        }

        const transientClones = this.backupData.map(b => {
            const tMesh = b.meshClone.clone();
            tMesh.geometry = b.geometryClone.clone();
            if (b.materialClone) tMesh.material = b.materialClone.clone();

            tMesh.position.copy(b.position);
            tMesh.quaternion.copy(b.quaternion);
            tMesh.scale.copy(b.scale);
            return tMesh;
        });

        this.resultID = booleanOperation(this.operation, transientClones, this.resultName).uuid;
    }

    undo() {
        const resultMesh = getMesh(this.resultID);
        if (resultMesh) {
            deleteObjects([resultMesh]);
        }

        this.currentLiveMeshes = this.backupData.map(b => {
            const freshClone = b.meshClone.clone();
            freshClone.uuid = b.uuid; // <-- force the original identity back, every time
            freshClone.geometry = b.geometryClone.clone();
            if (b.materialClone) freshClone.material = b.materialClone.clone();

            freshClone.position.copy(b.position);
            freshClone.quaternion.copy(b.quaternion);
            freshClone.scale.copy(b.scale);
            return freshClone;
        });

        this.currentLiveMeshes.forEach((mesh) => {
            mesh.children = [];
            instantiateObject(mesh, mesh.name, false, true, true);
        });

        selectObjects(this.currentLiveMeshes);
        redoStack.push(this);
    }
}

export class circularPattern {
    constructor(mesh, axis, radius, n) {
        this.mesh = mesh.clone();
        mesh.updateWorldMatrix(true, false);
        const originPos = new THREE.Vector3();
        mesh.getWorldPosition(originPos);
        const worldMatrix = new THREE.Matrix4();
        worldMatrix.copy(mesh.matrixWorld);
        const originScale = new THREE.Vector3();
        mesh.getWorldScale(originScale);
        this.mesh.position.copy(originPos);
        this.mesh.scale.copy(originScale);
        this.mesh.quaternion.setFromRotationMatrix(worldMatrix); 
        this.material = mesh.material.clone();
        this.originalName = mesh.name;
        this.axis = axis;
        this.radius = radius;
        this.n = n;
        this.execute();
    }

    execute() {
        this.result = generateCircularPattern(this.mesh, this.axis, this.radius, this.n, false);
    }

    undo() {
        deleteObjects(this.result);
        this.mesh.material = this.material;
        this.mesh.visible = true;
        instantiateObject(this.mesh, this.originalName, true, true, true);
        selectObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class rectangularPattern {
    constructor(mesh, plane, width, countA, length, countB) {
        this.mesh = mesh.clone();
        mesh.updateWorldMatrix(true, false);
        const originPos = new THREE.Vector3();
        mesh.getWorldPosition(originPos);
        const worldMatrix = new THREE.Matrix4();
        worldMatrix.copy(mesh.matrixWorld);
        const originScale = new THREE.Vector3();
        mesh.getWorldScale(originScale);
        this.mesh.position.copy(originPos);
        this.mesh.scale.copy(originScale);
        this.mesh.quaternion.setFromRotationMatrix(worldMatrix);
        this.material = mesh.material.clone();
        this.originalName = mesh.name;
        this.plane = plane;
        this.width = width;
        this.countA = countA;
        this.length = length;
        this.countB = countB;
        this.execute();
    }

    execute() {
        this.result = generateRectangularPattern(this.mesh,
            this.plane,
            this.width,
            this.countA,
            this.length,
            this.countB,
            false);
    }

    undo() {
        deleteObjects(this.result);
        this.mesh.material = this.material;
        this.mesh.visible = true;
        instantiateObject(this.mesh, this.originalName, true, true, true);
        selectObjects([this.mesh]);
        redoStack.push(this);
    }
}