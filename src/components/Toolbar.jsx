export default function Toolbar() {
  return (
    <div id="header">
      <div id="toolbar">
        <div>
          <button id="undo-button" className="tooltip">
            <img src="/icons/undo.svg" alt="Undo" width="24px" height="24px" />
            <div className="tooltip-text undo-tooltip">(CTRL + Z) Undo</div>
          </button>
          <button id="redo-button" className="tooltip">
            <img src="/icons/redo.svg" alt="Redo" width="24px" height="24px" />
            <div className="tooltip-text redo-tooltip">(CTRL + Shift + Z) Redo</div>
          </button>
        </div>
        <div id="tools" className="container">
          <button className="tool tooltip" id="move">
            <img src="/icons/move.svg" alt="Move" width="24px" height="24px" />
            <div className="tooltip-text">(g) Move</div>
          </button>
          <button className="tool tooltip" id="scale">
            <img src="/icons/scale.svg" alt="Scale" width="24px" height="24px" />
            <div className="tooltip-text">(s) Scale</div>
          </button>
          <button className="tool tooltip" id="rotate">
            <img src="/icons/rotate.svg" alt="Rotate" width="24px" height="24px" />
            <div className="tooltip-text">(r) Rotate</div>
          </button>
          <button className="tool tooltip" id="paint-button">
            <img src="/icons/paint-bucket.svg" alt="Paint" width="24px" height="24px" />
            <div className="tooltip-text">(p) Paint</div>
          </button>
        </div>
        <div id="primatives" className="container">
          <div className="dropdown">
            <button id="primatives-button" className="tooltip">+ Add Shape
              <div className="tooltip-text">(CTRL + Space) Add Shape</div>
            </button>
            <div className="dropdown-content" id="primatives-dropdown">
              <button className="primitive" id="cube">Cube</button>
              <button className="primitive" id="sphere">Sphere</button>
              <button className="primitive" id="cylinder">Cyllinder</button>
              <button className="primitive" id="cone">Cone</button>
              <button className="primitive" id="torus">Torus</button>
              <button className="primitive" id="wedge">Wedge</button>
            </div>
          </div>
          <button id="sketch-button" className="toolbar-btn tooltip" title="Draw 2D Sketch">
            <img src="/icons/sketch.svg" alt="Sketch" width="24px" height="24px" />
            <div className="tooltip-text">Create 2D Sketch</div>
          </button>

          <button id="extrude-button" className="toolbar-btn tooltip" title="Extrude Sketch">
            <img src="/icons/cuboid.svg" alt="Extrude" width="24px" height="24px" />
            <div className="tooltip-text">Extrude Sketch</div>
          </button>

          <button id="revolve-button" className="toolbar-btn tooltip" title="Revolve Sketch">
            <img src="/icons/circular-pattern.svg" alt="Revolve" width="24px" height="24px" />
            <div className="tooltip-text">Revolve Sketch</div>
          </button>
        </div>
        <div id="modifiers" className="container">
          <button className="modifier tooltip" id="merge">
            <img src="/icons/merge.svg" alt="Merge" width="24px" height="24px" />
            <div className="tooltip-text">(CTRL + m)
              Merge</div>
          </button>
          <button className="modifier tooltip" id="subtract">
            <img src="/icons/subtract.svg" alt="Subtract" width="24px" height="24px" />
            <div className="tooltip-text">(CTRL + o)
              Subtract</div>
          </button>
          <button className="modifier tooltip" id="intersect">
            <img src="/icons/intersect.svg" alt="Intersect" width="24px" height="24px" />
            <div className="tooltip-text">(CTRL + i)
              Intersect</div>
          </button>
        </div>
        <div id="patterns" className="container">
          <button className="pattern tooltip" id="circular">
            <img src="/icons/circular-pattern.svg" alt="Circular" width="24px" height="24px" />
            <div className="tooltip-text">Circular Pattern</div>
          </button>
          <button className="pattern tooltip" id="rectangular">
            <img src="/icons/grid-pattern.svg" alt="Rect" width="24px" height="24px" />
            <div className="tooltip-text">Rectangular Pattern</div>
          </button>
        </div>
      </div>
      {/* Hidden File Input */}
      <input type="file" id="image-file-input" accept="image/*" style={{ display: 'none' }} />

      {/* Import Button */}
      <button id="import-image-button" className="tooltip">
        <img src="/icons/image.svg" alt="Import" width="24px" height="24px" />
        <div className="tooltip-text">Import Reference Image</div>
      </button>
      <button id="export"><p id="download-icon">🢳</p><p id="download-text">Export Selected STLs</p></button>
    </div>
  );
}
