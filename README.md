# EasyCAD Documentation

This repository contains the source code for EasyCAD, a minimalistic Computer-Aided Design (CAD) software intended to enable makers to bring their ideas into reality using basic geometric shapes and manipulation tools.

## Project Overview

EasyCAD is a web-based application built using Three.js for 3D rendering and implemented with custom JavaScript modules for interactive control, command execution, and file export.

## File Structure

The repository is organized into several modules for separation of concerns:

*   `index.html`: The main entry point that loads the application, CSS, and JavaScript modules.
*   `style.css`: Contains the styling for the user interface.
*   `camera.js`: Manages the 3D scene, camera setup (orthographic and perspective), rendering, and post-processing effects.
*   `cad_tools.js`: Contains the core logic for object creation, selection management, geometric operations (Boolean operations), and pattern generation.
*   `commands.js`: Manages the command history (undo/redo stack) and the implementation of geometric operations and pattern creation logic.
*   `object_previews.js`: Handles the creation of temporary visual previews for pattern generation.
*   `viewcube.js`: Implements the interactive viewcube functionality for camera manipulation.
*   `editor_controls.js`: Manages the dynamic display of property inspectors and user interface elements based on the active tool.
*   `buttons.js`: Manages all user interface event listeners, including tool switching, command execution, and file export.
*   `keybinds.js`: Implements keyboard shortcuts for manipulating the canvas, selection, and executing commands.
*   `vite.config.js`: Configuration file for the Vite build tool.

## Key Features

### 3D Interaction
The application features interactive 3D manipulation through:
*   **Navigation:** Orbit controls implemented in `camera.js` for viewing the scene.
*   **Viewcube:** A viewcube implementation in `viewcube.js` allows for precise camera manipulation and snapping to object faces.
*   **Transform Controls:** Tools for moving, scaling, and rotating selected objects.

### Object Creation
Users can create fundamental 3D primitives:
*   Cube
*   Sphere
*   Cylinder
*   Cone
*   Torus

### Geometric Operations
The software supports boolean operations on selected objects using Three.js's `three-bvh-csg` library:
*   **Merge** (Intersection)
*   **Subtract**
*   **Intersect**

### Pattern Generation
Functions are provided to generate complex 2D patterns based on selected geometry:
*   **Circular Pattern:** Generates a pattern of objects around a central axis.
*   **Rectangular Pattern:** Generates a grid of objects based on a defined plane and dimensions.

### Export Functionality
Selected objects can be exported as STL files using the `STLExporter`.

## Initialization

The application initializes the scene and sets up the rendering pipeline by importing modules from the defined structure. The main loop is managed in `main.js`, which handles animation, rendering, and UI updates.

## Dependencies

The project relies on external libraries, including:
*   `three.js` (and associated modules)
*   `three-bvh-csg` for boolean operations
*   `three/addons/exporters/STLExporter.js` and `three/addons/loaders/STLLoader.js`
*   `three/examples/jsm/loaders/GLTFLoader.js`
*   `three/examples/jsm/postprocessing/EffectComposer.js` and related passes.

## Running the Application

The project is configured to be built using Vite. Execution is typically initiated by running the Vite development server command.

```bash
npm run dev
```

The application is designed to be accessed via a web browser.