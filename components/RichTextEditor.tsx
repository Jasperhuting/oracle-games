'use client'

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect } from 'react';
import { RichTextEditorProps } from '@/lib/types/component-props';

export const RichTextEditor = ({ content, onChange }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline',
        },
      }),
      Underline,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    immediatelyRender: false,
  });

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('bold')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Bold"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium italic transition-colors ${
            editor.isActive('italic')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Italic"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium underline transition-colors ${
            editor.isActive('underline')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Underline"
        >
          U
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium line-through transition-colors ${
            editor.isActive('strike')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Strikethrough"
        >
          S
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-bold transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Heading 1"
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-bold transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Heading 2"
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-bold transition-colors ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Heading 3"
        >
          H3
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Bullet List"
        >
          •
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Numbered List"
        >
          1.
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={addLink}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('link')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Add Link"
        >
          Link
        </button>

        {editor.isActive('link') && (
          <button
            type="button"
            onClick={removeLink}
            className="px-3 py-1.5 rounded text-sm cursor-pointer font-medium bg-white text-gray-700 hover:bg-gray-100 border"
            title="Remove Link"
          >
            Unlink
          </button>
        )}

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Quote"
        >
          &quot;
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium transition-colors ${
            editor.isActive('codeBlock')
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
          title="Code Block"
        >
          &lt;/&gt;
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-3 py-1.5 rounded text-sm cursor-pointer font-medium bg-white text-gray-700 hover:bg-gray-100 border"
          title="Horizontal Rule"
        >
          ―
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="px-3 py-1.5 rounded text-sm cursor-pointer font-medium bg-white text-gray-700 hover:bg-gray-100 border disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          ↶
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="px-3 py-1.5 rounded text-sm cursor-pointer font-medium bg-white text-gray-700 hover:bg-gray-100 border disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
        >
          ↷
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};
