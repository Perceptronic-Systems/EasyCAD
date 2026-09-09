import { useSyncExternalStore } from 'react';
import { editorPanelStore } from '../store.js';

function PropertyRow({ item }) {
  return (
    <div className="row">
      <span id={`label-${item.id}`}>{item.content}</span>
      <input
        id={item.id}
        className="property"
        defaultValue={item.defaultValue}
        autoFocus={!!item.focused}
      />
      {item.unit && <span className="unit">{item.unit}</span>}
    </div>
  );
}

function DropdownRow({ item }) {
  return (
    <div className="row">
      {item.content && <span id={`label-${item.id}`}>{item.content}</span>}
      <select id={item.id} className="dropdown-menu" defaultValue={item.defaultValue}>
        {(item.options || []).map((optionText) => (
          <option key={optionText} value={optionText}>{optionText}</option>
        ))}
      </select>
    </div>
  );
}

function ColorPickerRow({ item }) {
  return (
    <div className="row">
      <input id={item.id} type="color" defaultValue={item.defaultValue || '#F01515'} />
    </div>
  );
}

function CheckboxRow({ item }) {
  return (
    <div className="row">
      <label>{item.content}</label>
      <input id={item.id} type="checkbox" defaultChecked={!!item.defaultValue} />
    </div>
  );
}

function TitleRow({ item }) {
  return (
    <div className="row">
      <h3>{item.defaultValue}</h3>
      <button id="close-window" className="close">×</button>
    </div>
  );
}

function ConfirmationRow({ item }) {
  return (
    <div className="row">
      <button id={item.id} className="apply">{item.content || 'Apply'}</button>
    </div>
  );
}

function Field({ item }) {
  switch (item.element) {
    case 'property': return <PropertyRow item={item} />;
    case 'dropdown': return <DropdownRow item={item} />;
    case 'color-picker': return <ColorPickerRow item={item} />;
    case 'checkbox': return <CheckboxRow item={item} />;
    case 'title': return <TitleRow item={item} />;
    case 'confirmation': return <ConfirmationRow item={item} />;
    default: {
      const Tag = item.element;
      return <Tag id={item.id} className={item.class} dangerouslySetInnerHTML={{ __html: item.content }} />;
    }
  }
}

/**
 * Renders the tool editor overlay from whatever field-array is currently in
 * editorPanelStore (the same shape the old setEditor() used to receive and hand-build
 * into raw DOM). This component's only job is putting the right DOM in place with the
 * right ids/classes - reading values, live-updating previews, and wiring up Apply/Finish
 * buttons is all still handled by the existing engine code (editor_controls.js's
 * updateTransform/updateEditorControls, and the delegated click/input listeners set up
 * once the engine boots), exactly as before, via document.querySelector against these
 * same ids. Inputs are uncontrolled (defaultValue/defaultChecked, not value/checked) so
 * React doesn't fight the engine's imperative .value updates.
 */
export default function EditorPanel() {
  const fields = useSyncExternalStore(editorPanelStore.subscribe, editorPanelStore.get);

  if (!fields) {
    // Keep a stable, empty node in the DOM (rather than unmounting) so nothing that
    // queries #editor-controls before a tool is selected has to null-check the element.
    return <div id="editor-controls" className="overlay" style={{ display: 'none' }} />;
  }

  return (
    <div id="editor-controls" className="overlay" style={{ display: 'flex' }}>
      {fields.map((item, i) => (
        <Field key={item.id || i} item={item} />
      ))}
    </div>
  );
}
