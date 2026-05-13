import { selectAll, copy, paste, deselectObjects, booleanToSelection, removeSelected, selectedObjects, shiftDown, ctrlDown } from "./cad_tools.js";
import { unselectTool, setTool, editorControls } from "./editor_controls.js";

const primativesDropdown = document.getElementById('primatives-dropdown');

document.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case "escape":
      event.preventDefault();
      unselectTool()
      break;
    case 'delete':
      event.preventDefault();
      if (confirm("Are you sure you would like to delete selected objects?")) {
        removeSelected();
        deselectObjects();
      }
    case ' ':
      event.preventDefault();
      if (ctrlDown) {
        if (primativesDropdown ) {
          console.log('show dropdown')
          primativesDropdown.style.display = 'flex';
          primativesDropdown.children[0].focus();
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
    case 'c':
      event.preventDefault();
      if (ctrlDown) {
        copy();
      }
      break;
    case 'm':
      event.preventDefault();
      if (ctrlDown) booleanToSelection('merge', 'Combined Part');
      break;
    case 'o':
      event.preventDefault();
      if (ctrlDown) booleanToSelection('subtract', 'Combined Part');
      break;
    case 'i':
      event.preventDefault();
      if (ctrlDown) booleanToSelection('intersect', 'Combined Part');
      break;
    case 'v':
      event.preventDefault();
      if (ctrlDown) {
        paste();
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
    if (event.key === "Tab" || event.key === "Enter" || ['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      let inputs = [];
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
      }

      let nextIndex = 0;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = currentIndex - 1;
      } else {
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