import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { List, ListOrdered } from 'lucide-react';

// Create a named instance to avoid conflicts
const CustomUnderline = Underline.extend({ name: 'customUnderline' });

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  className = ''
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomUnderline,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2 text-xs',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-border rounded-lg bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all ${className}`}>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('bulletList') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('orderedList') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
