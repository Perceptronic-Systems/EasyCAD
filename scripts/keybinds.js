import { deselectObjects, removeObject, selectedObjects } from "./cad_tools.js";
import { unselectTool, setTool } from "./editor_controls.js";

document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case "Escape":
      unselectTool()
      break;
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