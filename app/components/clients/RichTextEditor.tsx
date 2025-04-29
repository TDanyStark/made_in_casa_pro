import { useEditor, EditorContent, EditorContext } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { MarkButton } from "../tiptap-ui/mark-button";
import { HeadingButton } from "../tiptap-ui/heading-button";
import { ListButton } from "../tiptap-ui/list-button";
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list';

import { Underline } from '@tiptap/extension-underline'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'

// estilos sass
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  noBorder = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noBorder?: boolean;
}) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), Underline, Superscript, Subscript],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: noBorder 
          ? "min-h-[250px] px-3 py-2 focus:outline-none border-none max-w-[950px]" 
          : "min-h-[250px] border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus-visible:ring-ring max-w-[950px]",
      },
    },
  });

  return (
    <div className="rich-text-editor">
      <EditorContext.Provider value={{ editor }}>
        <div className="toolbar flex items-center flex-wrap gap-2 mb-2 p-2 border border-input rounded-md max-w-fit">
          <div className="tiptap-button-group " data-orientation="horizontal">
            <MarkButton type="bold" />
            <MarkButton type="italic" />
            <MarkButton type="strike" />
            <MarkButton type="code" />
            <MarkButton type="underline" />
            <MarkButton type="superscript" />
            <MarkButton type="subscript" />
            <HeadingButton level={1}></HeadingButton>
            <HeadingButton level={2}></HeadingButton>
            <HeadingButton level={3}></HeadingButton>
            <ListButton type="bulletList" />
          </div>
        </div>
        <EditorContent editor={editor} placeholder={placeholder} />
      </EditorContext.Provider>
    </div>
  );
};