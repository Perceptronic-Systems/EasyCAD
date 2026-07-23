import { remove } from "three/examples/jsm/libs/tween.module.js";
import { selectAll, copy, deselectObjects, booleanToSelection, removeSelected, selectedObjects, shiftDown, ctrlDown } from "./cad_tools.js";
import { undo, redo, undoStack, redoStack, paste, addObject, removeObjects, combineObjects } from './commands.js';
import { unselectTool, setTool, editorControls } from "./editor_controls.js";
import { isSketchActive, undoLastPoint } from './sketch_tools.js';
import { updateUndoRedoButtons } from './buttons.js';

const primativesDropdown = document.getElementById('primatives-dropdown');

document.addEventListener('keydown', (event) => {
  const selection = Object.values(selectedObjects);
  switch (event.key.toLowerCase()) {
    case "escape":
      event.preventDefault();
      if (isSketchActive()) {
        cancelSketch();
      }
      unselectTool();
      break;
    case 'delete':
      event.preventDefault();
      if (confirm("Are you sure you would like to delete selected objects?")) {
        undoStack.push(new removeObjects(Object.values(selectedObjects)));
      }
    case ' ':
      event.preventDefault();
      if (ctrlDown) {
        if (primativesDropdown ) {
          primativesDropdown.style.visibility = 'visible';
          primativesDropdown.style.opacity = 1;
          primativesDropdown.children[0].focus();
        }
      }
      break;
    case "z":
      if (ctrlDown) {
        event.preventDefault();
        if (isSketchActive()) {
          undoLastPoint(); // Step back one point in active sketch session
        } else if (shiftDown) {
          if (redoStack.length > 0) {
            redo();
            updateUndoRedoButtons();
          }
        } else {
          if (undoStack.length > 0) {
            undo();
            updateUndoRedoButtons();
          }
        }
      }
      break;
    case 'a':
      event.preventDefault();
      if (ctrlDown) {
        if (!shiftDown) {
          selectAll();
        } else {
          deselectObjects();
        }
      }
      break;
    case 'g':
      event.preventDefault();
      setTool('move');
      break;
    case 'r':
      event.preventDefault();
      setTool('rotate');
      break;
    case 's':
      event.preventDefault();
      setTool('scale');
      break;
    case 'p':
      event.preventDefault();
      setTool('paint');
      break;
    case 'c':
      event.preventDefault();
      if (ctrlDown) {
        copy();
      }
      break;
    case 'm':
      event.preventDefault();
      if (ctrlDown) undoStack.push(new combineObjects(selection, 'merge', 'Combined Part'));
      break;
    case 'o':
      event.preventDefault();
      if (ctrlDown) undoStack.push(new combineObjects(selection, 'subtract', 'Combined Part'));
      break;
    case 'i':
      event.preventDefault();
      if (ctrlDown) undoStack.push(new combineObjects(selection, 'intersect', 'Combined Part'));
      break;
    case 'v':
      event.preventDefault();
      if (ctrlDown) {
        undoStack.push(new paste());
      }
      break;
    case 'd':
      event.preventDefault();
      if (ctrlDown) {
        copy();
        paste();
      }
  }
  try {
    if (event.key === "Tab" || event.key === "Enter" || ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      let inputs = [];
      let nextIndex = 0;
      if (editorControls.contains(document.activeElement)) {
        inputs = Array.from(editorControls.querySelectorAll('.property, #close-window'));
      } else {
        inputs = Array.from(document.activeElement.parentElement.querySelectorAll('button, input'))
      }
      if (!inputs) return;
      const currentIndex = inputs.indexOf(document.activeElement);

      if (document.activeElement.tagName === 'BUTTON' && event.key === "Enter") {
        document.activeElement.click();
        return;
      } else {
        nextIndex = currentIndex + 1;
      }

      if (event.key === 'ArrowUp') {
        nextIndex = currentIndex - 1;
      } else if (event.key === 'ArrowDown') {
         nextIndex = currentIndex + 1;
      }
      if (nextIndex >= inputs.length) {
        nextIndex = 0;
      }
      inputs[nextIndex].focus();
    }
  } catch (error) {
    console.log('an error occured durring editor controls key navigation');
    console.log(error);
  }

});