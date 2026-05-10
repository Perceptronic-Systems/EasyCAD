import { cubeTexture } from "three/tsl";
import { selectAll, copy, paste, deselectObjects, booleanToSelection, removeObject, selectedObjects, shiftDown, ctrlDown, activeTool } from "./cad_tools.js";
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
      setTool('move');
      break;
    case 'r':
      setTool('rotate');
      break;
    case 's':
      setTool('scale');
      break;
    case 'c':
      event.preventDefault();
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
      event.preventDefault();
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