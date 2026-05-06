import { deselectObjects, removeObject } from "cad_tools.js";
import { unselectTool, setTool } from "editor_controls.js";

let shiftDown = false;
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case "Escape":
      unselectTool()
      break;
    case 'Shift':
      shiftDown = true;
      break
    case 'Delete':
      if (confirm("Are you sure you would like to delete selected objects?")) {
        for (const name of Object.keys(selectedObjects)) {
          removeObject(name);
        }
        deselectObjects();
      }
    case 'g':
      setTool('move');
      break;
    case 'r':
      setTool('rotate');
      break;
    case 's':
      setTool('scale');
      break;
  }

});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') shiftDown = false;
});