'use client';

import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List } from 'tabler-icons-react';

const EMOJI_CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: 'recent',
    label: 'Recent',
    emojis: ['😀', '👍', '🎉', '🔥', '✅', '🚴'],
  },
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: [
      '😀','😁','😂','🤣','😅','😊','😍','😘','😎','🤔','😇','😴','😵','😴','😬','😐','😑','😶',
      '😮','😯','😲','😳','🥺','😢','😭','😡','🤯','😱','😈','👀','🙌','🙏','👏','👍','👎','🤝',
    ],
  },
  {
    id: 'sports',
    label: 'Sport',
    emojis: [
      '🚴','🚲','🏁','🏆','🥇','🥈','🥉','⏱️','⏲️','🎯','⚽','🏀','🏈','🎾','🥊','🏋️',
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    emojis: [
      '✅','❌','⚡','💡','📌','📝','📣','🔔','🔒','🔓','⭐','✨','💬','🧠','❤️','💔',
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    emojis: ['☀️','🌤️','⛅','🌧️','⛈️','❄️','🌈','🍃','🌿','🌊','🔥'],
  },
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [activeCategory, setActiveCategory] = useState('recent');

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

  const activeEmojis =
    EMOJI_CATEGORIES.find((category) => category.id === activeCategory)?.emojis ||
    EMOJI_CATEGORIES[0].emojis;

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
        <div className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowEmojis((prev) => !prev)}
            className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-200"
          >
            🙂
          </button>
          {showEmojis && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80">
              <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                {EMOJI_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-2 py-1 text-xs rounded ${
                      activeCategory === category.id
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              <div className="p-2 max-h-56 overflow-y-auto grid grid-cols-8 gap-1">
                {activeEmojis.map((emoji) => (
                  <button
                    key={`${activeCategory}-${emoji}`}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().insertContent(emoji).run();
                      setShowEmojis(false);
                    }}
                    className="text-lg hover:bg-gray-100 rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
