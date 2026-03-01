'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List } from 'tabler-icons-react';
import GiphyPicker from '@/components/giphy/GiphyPicker';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const emojiPickerWrapperRef = useRef<HTMLDivElement | null>(null);
  const giphyPickerWrapperRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: true }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[120px] focus:outline-none text-sm text-gray-800 leading-relaxed',
        'data-placeholder': placeholder || '',
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
    if (!showEmojis && !showGiphy) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedEmoji = emojiPickerWrapperRef.current?.contains(target);
      const clickedGiphy = giphyPickerWrapperRef.current?.contains(target);
      if (!clickedEmoji) {
        setShowEmojis(false);
      }
      if (!clickedGiphy) {
        setShowGiphy(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showEmojis, showGiphy]);

  const isActive = useMemo(() => ({
    bold: editor?.isActive('bold'),
    italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'),
    bulletList: editor?.isActive('bulletList'),
  }), [editor]);

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
          className={`p-1.5 rounded ${isActive.bold ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          aria-label="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded ${isActive.italic ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          aria-label="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded ${isActive.underline ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          aria-label="Underline"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded ${isActive.bulletList ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          aria-label="Bullet list"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('Link URL');
            if (url) {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
          className="p-1.5 rounded text-gray-600 hover:bg-gray-200"
          aria-label="Link"
        >
          <LinkIcon size={16} />
        </button>
        <div ref={emojiPickerWrapperRef} className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowEmojis((prev) => !prev)}
            className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-200"
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
            className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-200"
          >
            GIF
          </button>
          {showGiphy && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <GiphyPicker
                onSelect={(gif) => {
                  const safeTitle = (gif.title || 'GIF').replace(/"/g, '&quot;');
                  editor.chain().focus().insertContent(`<img src="${gif.url}" alt="${safeTitle}" />`).run();
                  setShowGiphy(false);
                }}
                width={300}
              />
            </div>
          )}
        </div>
      </div>
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
