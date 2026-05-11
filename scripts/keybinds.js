import { selectAll, copy, paste, deselectObjects, booleanToSelection, removeObject, selectedObjects, shiftDown, ctrlDown } from "./cad_tools.js";
import { unselectTool, setTool } from "./editor_controls.js";

document.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case "escape":
      event.preventDefault();
      unselectTool()
      break;
    case 'delete':
      event.preventDefault();
      if (confirm("Are you sure you would like to delete selected objects?")) {
        for (const name of Object.keys(selectedObjects)) {
          removeObject(name);
        }
        deselectObjects();
      }
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

});