'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import {
  TableView,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  mergeCells,
  splitCell,
  tableEditing,
  toggleHeaderColumn,
  toggleHeaderRow,
} from 'prosemirror-tables';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    forumTable: {
      insertTable: (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) => ReturnType;
      addColumnBefore: () => ReturnType;
      addColumnAfter: () => ReturnType;
      deleteColumn: () => ReturnType;
      addRowBefore: () => ReturnType;
      addRowAfter: () => ReturnType;
      deleteRow: () => ReturnType;
      deleteTable: () => ReturnType;
      mergeCells: () => ReturnType;
      splitCell: () => ReturnType;
      toggleHeaderRow: () => ReturnType;
      toggleHeaderColumn: () => ReturnType;
      goToNextCell: (direction: number) => ReturnType;
    };
    forumImage: {
      setImage: (options: { src: string; alt?: string | null; title?: string | null }) => ReturnType;
    };
  }
}

function parseColwidth(value: string | null, colspan: number): number[] | null {
  if (!value || !/^\d+(,\d+)*$/.test(value)) {
    return null;
  }

  const widths = value.split(',').map(Number);
  return widths.length === colspan ? widths : null;
}

function createTable(editor: Editor, rows: number, cols: number, withHeaderRow: boolean) {
  const { table, tableRow, tableCell, tableHeader } = editor.schema.nodes;

  const rowNodes = Array.from({ length: rows }, (_, rowIndex) => {
    const cellType = rowIndex === 0 && withHeaderRow ? tableHeader : tableCell;
    const cells = Array.from({ length: cols }, () => cellType.createAndFill()).filter(
      (cell): cell is NonNullable<typeof cell> => cell !== null
    );
    return tableRow.createChecked(null, cells);
  });

  return table.createChecked(null, rowNodes);
}

export const ForumImage = Node.create({
  name: 'image',

  group: 'block',

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: options,
          }),
    };
  },
});

export const ForumTable = Node.create({
  name: 'table',

  group: 'block',

  content: 'tableRow+',

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      resizable: true,
    };
  },

  extendNodeSchema() {
    return {
      tableRole: 'table',
    };
  },

  parseHTML() {
    return [{ tag: 'table' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['tbody', 0]];
  },

  addCommands() {
    return {
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ editor, state, dispatch }) => {
          const table = createTable(editor, rows, cols, withHeaderRow);
          const offset = table.nodeSize + 1;

          if (dispatch) {
            const tr = state.tr.replaceSelectionWith(table).scrollIntoView();
            tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tr.selection.from + offset, tr.doc.content.size))));
            dispatch(tr);
          }

          return true;
        },
      addColumnBefore:
        () =>
        ({ state, dispatch }) =>
          addColumnBefore(state, dispatch),
      addColumnAfter:
        () =>
        ({ state, dispatch }) =>
          addColumnAfter(state, dispatch),
      deleteColumn:
        () =>
        ({ state, dispatch }) =>
          deleteColumn(state, dispatch),
      addRowBefore:
        () =>
        ({ state, dispatch }) =>
          addRowBefore(state, dispatch),
      addRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatch),
      deleteRow:
        () =>
        ({ state, dispatch }) =>
          deleteRow(state, dispatch),
      deleteTable:
        () =>
        ({ state, dispatch }) =>
          deleteTable(state, dispatch),
      mergeCells:
        () =>
        ({ state, dispatch }) =>
          mergeCells(state, dispatch),
      splitCell:
        () =>
        ({ state, dispatch }) =>
          splitCell(state, dispatch),
      toggleHeaderRow:
        () =>
        ({ state, dispatch }) =>
          toggleHeaderRow(state, dispatch),
      toggleHeaderColumn:
        () =>
        ({ state, dispatch }) =>
          toggleHeaderColumn(state, dispatch),
      goToNextCell:
        (direction) =>
        ({ state, dispatch }) =>
          goToNextCell(direction as -1 | 1)(state, dispatch),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.goToNextCell(1),
      'Shift-Tab': () => this.editor.commands.goToNextCell(-1),
    };
  },

  addProseMirrorPlugins() {
    const plugins = [tableEditing()];

    if (this.options.resizable) {
      plugins.unshift(
        columnResizing({
          View: TableView,
          cellMinWidth: 120,
          lastColumnResizable: true,
        })
      );
    }

    return plugins;
  },
});

export const ForumTableRow = Node.create({
  name: 'tableRow',

  content: '(tableCell | tableHeader)*',

  extendNodeSchema() {
    return {
      tableRole: 'row',
    };
  },

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML() {
    return ['tr', 0];
  },
});

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => Number(element.getAttribute('colspan') || 1),
    renderHTML: (attributes: { colspan?: number }) =>
      attributes.colspan && attributes.colspan > 1 ? { colspan: attributes.colspan } : {},
  },
  rowspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => Number(element.getAttribute('rowspan') || 1),
    renderHTML: (attributes: { rowspan?: number }) =>
      attributes.rowspan && attributes.rowspan > 1 ? { rowspan: attributes.rowspan } : {},
  },
  colwidth: {
    default: null,
    parseHTML: (element: HTMLElement) =>
      parseColwidth(element.getAttribute('data-colwidth'), Number(element.getAttribute('colspan') || 1)),
    renderHTML: (attributes: { colwidth?: number[] | null }) =>
      attributes.colwidth?.length ? { 'data-colwidth': attributes.colwidth.join(',') } : {},
  },
};

export const ForumTableCell = Node.create({
  name: 'tableCell',

  content: 'block+',

  isolating: true,

  addAttributes() {
    return cellAttributes;
  },

  extendNodeSchema() {
    return {
      tableRole: 'cell',
    };
  },

  parseHTML() {
    return [{ tag: 'td' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  },
});

export const ForumTableHeader = Node.create({
  name: 'tableHeader',

  content: 'block+',

  isolating: true,

  addAttributes() {
    return cellAttributes;
  },

  extendNodeSchema() {
    return {
      tableRole: 'header_cell',
    };
  },

  parseHTML() {
    return [{ tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0];
  },
});
