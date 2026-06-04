import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { CursorPosition } from '../../types';

interface CodeEditorProps {
  value: string;
  onChange: (content: string) => void;
  onCursorChange: (cursor: CursorPosition) => void;
  language?: 'javascript' | 'typescript' | 'html' | 'css' | 'python' | 'json' | 'text';
}

export interface CodeEditorHandle {
  getView: () => EditorView | null;
}

const languageExtensions: Record<string, any> = {
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  html: html(),
  css: css(),
  python: python(),
  json: json(),
  text: [],
};

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>((
  { value, onChange, onCursorChange, language = 'text' },
  ref
) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isRemoteUpdateRef = useRef(false);
  const lastContentRef = useRef<string>(value);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    getView: () => editorViewRef.current,
  }));

  useEffect(() => {
    if (!editorRef.current) return;

    const langExt = languageExtensions[language] || [];

    const handleUpdate = (update: ViewUpdate) => {
      if (isRemoteUpdateRef.current) return;

      if (update.docChanged) {
        const content = update.state.doc.toString();
        if (content !== lastContentRef.current) {
          lastContentRef.current = content;
          onChange(content);
        }
      }

      if (update.selectionSet) {
        const selection = update.state.selection.main;
        const line = update.state.doc.lineAt(selection.head);
        const cursor: CursorPosition = {
          userId: '',
          line: line.number - 1,
          column: selection.head - line.from,
        };

        if (selection.from !== selection.to) {
          const anchorLine = update.state.doc.lineAt(selection.anchor);
          cursor.selection = {
            anchor: {
              line: anchorLine.number - 1,
              column: selection.anchor - anchorLine.from,
            },
            head: {
              line: line.number - 1,
              column: selection.head - line.from,
            },
          };
        }

        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
        }
        cursorTimeoutRef.current = setTimeout(() => {
          onCursorChange(cursor);
        }, 30);
      }
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        langExt,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(handleUpdate),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
          },
          '.cm-content': {
            padding: '16px 0',
          },
          '.cm-line': {
            padding: '0 16px',
          },
          '.cm-gutters': {
            backgroundColor: '#1e293b',
            borderRight: '1px solid #334155',
            color: '#64748b',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#334155',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(51, 65, 85, 0.3)',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    editorViewRef.current = view;
    lastContentRef.current = value;

    return () => {
      view.destroy();
      editorViewRef.current = null;
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [language]);

  useEffect(() => {
    if (!editorViewRef.current) return;
    
    if (value !== lastContentRef.current) {
      isRemoteUpdateRef.current = true;
      try {
        const view = editorViewRef.current;
        const currentContent = view.state.doc.toString();
        
        if (value !== currentContent) {
          const transaction = view.state.update({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: value,
            },
          });
          view.dispatch(transaction);
          lastContentRef.current = value;
        }
      } finally {
        isRemoteUpdateRef.current = false;
      }
    }
  }, [value]);

  return (
    <div className="relative w-full h-full bg-slate-900">
      <div ref={editorRef} className="w-full h-full" />
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export { CodeEditor };
