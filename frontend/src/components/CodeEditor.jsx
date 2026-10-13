import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { cpp } from "@codemirror/lang-cpp";

// A code editor with line numbers and C++ colouring (CodeMirror). React
// keeps the text; CodeMirror owns the typing, so the two are kept in step
// in both directions below.
export default function CodeEditor({ value, onChange, label }) {
  const host = useRef(null);
  const view = useRef(null);
  // The newest onChange, without rebuilding the editor each time it changes.
  const latestOnChange = useRef(onChange);
  const firstValue = useRef(value);

  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const editor = new EditorView({
      doc: firstValue.current,
      parent: host.current,
      extensions: [
        basicSetup,
        cpp(),
        EditorView.contentAttributes.of({ "aria-label": label }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latestOnChange.current(update.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    return () => editor.destroy();
  }, [label]);

  // Text changed from outside (Reset, choosing a device): show it.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const shown = editor.state.doc.toString();
    if (value !== shown) editor.dispatch({ changes: { from: 0, to: shown.length, insert: value } });
  }, [value]);

  return <div className="code-editor" ref={host} />;
}
