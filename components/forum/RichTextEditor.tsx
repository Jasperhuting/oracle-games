'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extensions';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List } from 'tabler-icons-react';
import GiphyPicker from '@/components/giphy/GiphyPicker';
import {
  ForumImage,
  ForumTable,
  ForumTableCell,
  ForumTableHeader,
  ForumTableRow,
} from '@/components/forum/editorExtensions';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const emojiPickerWrapperRef = useRef<HTMLDivElement | null>(null);
  const giphyPickerWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableMenuWrapperRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: placeholder || 'Schrijf iets...',
      }),
      ForumImage,
      ForumTable,
      ForumTableRow,
      ForumTableHeader,
      ForumTableCell,
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'ProseMirror min-h-[160px] focus:outline-none text-sm text-gray-800 leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = value || '';
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!showEmojis && !showGiphy && !showTableMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedEmoji = emojiPickerWrapperRef.current?.contains(target);
      const clickedGiphy = giphyPickerWrapperRef.current?.contains(target);
      const clickedTableMenu = tableMenuWrapperRef.current?.contains(target);
      if (!clickedEmoji) {
        setShowEmojis(false);
      }
      if (!clickedGiphy) {
        setShowGiphy(false);
      }
      if (!clickedTableMenu) {
        setShowTableMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showEmojis, showGiphy, showTableMenu]);

  const isActive = useMemo(() => ({
    bold: editor?.isActive('bold'),
    italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'),
    strike: editor?.isActive('strike'),
    bulletList: editor?.isActive('bulletList'),
    orderedList: editor?.isActive('orderedList'),
    heading2: editor?.isActive('heading', { level: 2 }),
    heading3: editor?.isActive('heading', { level: 3 }),
    blockquote: editor?.isActive('blockquote'),
    table: editor?.isActive('table'),
  }), [editor]);

  const toolbarButtonClass = (active = false) =>
    `px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
      active
        ? 'bg-primary text-white border-primary'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
    }`;

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-md p-3 text-sm text-gray-500">
        Editor laden...
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-md bg-white overflow-visible">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 bg-gray-50 overflow-visible relative">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarButtonClass(Boolean(isActive.bold))}
          aria-label="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarButtonClass(Boolean(isActive.italic))}
          aria-label="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarButtonClass(Boolean(isActive.underline))}
          aria-label="Underline"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={toolbarButtonClass(Boolean(isActive.strike))}
          aria-label="Strikethrough"
        >
          S
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolbarButtonClass(Boolean(isActive.heading2))}
          aria-label="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={toolbarButtonClass(Boolean(isActive.heading3))}
          aria-label="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarButtonClass(Boolean(isActive.bulletList))}
          aria-label="Bullet list"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarButtonClass(Boolean(isActive.orderedList))}
          aria-label="Ordered list"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={toolbarButtonClass(Boolean(isActive.blockquote))}
          aria-label="Blockquote"
        >
          &quot;
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={toolbarButtonClass()}
          aria-label="Horizontal rule"
        >
          ---
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('Link URL');
            if (url) {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
          className={toolbarButtonClass(Boolean(editor.isActive('link')))}
          aria-label="Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className={toolbarButtonClass()}
          aria-label="Remove link"
        >
          unlink
        </button>
        <div ref={tableMenuWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setShowTableMenu((prev) => !prev)}
            className={toolbarButtonClass(Boolean(isActive.table))}
          >
            Tabel
          </button>
          {showTableMenu && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                    setShowTableMenu(false);
                  }}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Nieuwe tabel
                </button>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Plakken vanuit Excel, Numbers of Google Sheets blijft ondersteund.
                </p>
              </div>
            </div>
          )}
        </div>
        <div ref={emojiPickerWrapperRef} className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowEmojis((prev) => !prev)}
            className={toolbarButtonClass()}
          >
            🙂
          </button>
          {showEmojis && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <EmojiPicker
                theme={Theme.LIGHT}
                lazyLoadEmojis
                onEmojiClick={(emojiData: EmojiClickData) => {
                  editor.chain().focus().insertContent(emojiData.emoji).run();
                  setShowEmojis(false);
                }}
              />
            </div>
          )}
        </div>
        <div ref={giphyPickerWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setShowGiphy((prev) => !prev)}
            className={toolbarButtonClass()}
          >
            GIF
          </button>
          {showGiphy && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <GiphyPicker
                onSelect={(gif) => {
                  const safeTitle = (gif.title || 'GIF').replace(/"/g, '&quot;');
                  editor.chain().focus().setImage({ src: gif.url, alt: safeTitle }).run();
                  setShowGiphy(false);
                }}
                width={300}
              />
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-gray-100 bg-white px-3 py-2 text-xs text-gray-500">
        Je kunt tabellen direct uit Excel, Numbers of Google Sheets plakken en daarna verder bewerken.
      </div>
      <div className="overflow-x-auto px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
