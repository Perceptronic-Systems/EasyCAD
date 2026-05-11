import { selectAll, copy, paste, deselectObjects, booleanToSelection, removeObject, selectedObjects, shiftDown, ctrlDown } from "./cad_tools.js";
import { unselectTool, setTool } from "./editor_controls.js";

document.addEventListener('keydown', (event) => {
  event.preventDefault();
  switch (event.key.toLowerCase()) {
    case "escape":
      unselectTool()
      break;
    case 'delete':
      if (confirm("Are you sure you would like to delete selected objects?")) {
        for (const name of Object.keys(selectedObjects)) {
          removeObject(name);
        }
        deselectObjects();
      }
    case 'a':
      if (ctrlDown) {
        if (!shiftDown) {
          selectAll();
        } else {
          deselectObjects();
        }
      }
      break;
    case 'g':
      setTool('move');
      break;
    case 'r':
      setTool('rotate');
      break;
    case 's':
      setTool('scale');
      break;
    case 'c':
      if (ctrlDown) {
        copy();
      }
      break;
    case 'm':
      if (ctrlDown) booleanToSelection('merge', 'Combined Part');
      break;
    case 'o':
      if (ctrlDown) booleanToSelection('subtract', 'Combined Part');
      break;
    case 'i':
      if (ctrlDown) booleanToSelection('intersect', 'Combined Part');
      break;
    case 'v':
      if (ctrlDown) {
        paste();
      }
      break;
    case 'd':
      if (ctrlDown) {
        copy();
        paste();
      }
  }

});