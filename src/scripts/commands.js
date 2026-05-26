import { select } from 'three/tsl';
import { booleanOperation, instantiateObject, deleteObjects, createPrimitive, selectionGroup, selectedObjects, transformHelper, deselectObjects, selectObjects } from './cad_tools.js';
import { defineSelectionGroup, transformControls } from './transform_controls.js';
import { generateCircularPattern, generateRectangularPattern } from './cad_tools.js';
import { scene } from './camera.js';

export let undoStack = [];
export let redoStack = [];

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
    mouseDown = false;
    const userData = transformControls.object.userData;
    if (!userData.oldPos) return;
    if (transformControls.mode === 'translate') {
        undoStack.push(new setPosition(transformControls.object, userData.oldPos, transformControls.object.position.clone()));
    } else if (transformControls.mode === 'scale') {
        undoStack.push(new setScale(transformControls.object, userData.oldScale, transformControls.object.scale.clone()));
    } else if (transformControls.mode === 'rotate') {
        undoStack.push(new setRotation(transformControls.object, userData.oldRot, transformControls.object.rotation.clone()));
    }
});

export class addPrimitive {
    constructor(meshName, type, size, position) {
        this.meshName = meshName;
        this.type = type;
        this.size = size;
        this.position = position;
        this.execute();
    }
    execute() {
        this.mesh = createPrimitive(this.meshName, this.type, this.size, this.position);
    }
    undo() {
        deleteObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class addObject {
    constructor(mesh, meshName) {
        this.mesh = mesh;
        this.mesh.name = meshName;
        this.meshName = meshName;
        this.execute();
    }
    execute() {
        instantiateObject(this.mesh, this.meshName);
    }
    undo() {
        deleteObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class removeObjects {
    constructor(meshes) {
        this.meshes = meshes;
        this.execute();
    }
    execute() {
        deleteObjects(this.meshes);
    }
    undo() {
        this.meshes.forEach(mesh => {
            try {
                instantiateObject(mesh, mesh.name, true, true);
            } catch (error) {
                console.log('An error occured when re-creating the deleted object:');
                console.log(error);
            }
        })
        redoStack.push(this);
    }
}

export class setPosition {
    constructor(mesh, oldPos, newPos) {
        this.mesh = mesh;
        this.newPos = newPos;
        this.oldPos = oldPos;
        this.execute();
    }
    execute() {
        this.mesh.position.copy(this.newPos);
    }
    undo() {
        this.mesh.position.copy(this.oldPos);
        redoStack.push(this);
    }
}

export class setScale {
    constructor(mesh, oldScale, newScale) {
        this.mesh = mesh;
        this.oldScale = oldScale;
        this.newScale = newScale;
        this.execute();
    }
    execute() {
        this.mesh.scale.copy(this.newScale);
    }
    undo() {
        this.mesh.scale.copy(this.oldScale);
        redoStack.push(this);
    }
}

export class setRotation {
    constructor(mesh, oldRot, newRot) {
        this.mesh = mesh;
        this.oldRot = oldRot;
        this.newRot = newRot;
        this.execute();
    }
    execute() {
        this.mesh.rotation.copy(this.newRot);
    }
    undo() {
        this.mesh.rotation.copy(this.oldRot);
        redoStack.push(this);
    }
}

export class combineObjects {
    constructor(meshes, operation, resultName) {
        if (!meshes) console.log('Error, cannot combine objects, meshes are missing!');
        deselectObjects();
        this.meshes = meshes;
        this.operation = operation;
        this.resultName = resultName;
        this.execute();
    }
    execute() {
        this.result = booleanOperation(this.operation, this.meshes, this.resultName);
    }
    undo() {
        deleteObjects([this.result])
        this.meshes.forEach(mesh => {
            instantiateObject(mesh);
        });
        selectObjects(this.meshes);
        redoStack.push(this);
    }
}

export class circularPattern {
    constructor(mesh, axis, radius, n) {
        deselectObjects();
        this.mesh = mesh.clone();
        this.material = mesh.material.clone();
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
        instantiateObject(this.mesh);
        selectObjects([this.mesh]);
        redoStack.push(this);
    }
}

export class rectangularPattern {
    constructor(mesh, plane, width, countA, length, countB) {
        deselectObjects();
        this.mesh = mesh.clone();
        this.material = mesh.material.clone();
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
        instantiateObject(this.mesh);
        selectObjects([this.mesh]);
        redoStack.push(this);
    }
}