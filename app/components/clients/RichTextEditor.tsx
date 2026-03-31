import { useState } from "react";
import { useEditor, EditorContent, EditorContext } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { MarkButton } from "../tiptap-ui/mark-button";
import { HeadingButton } from "../tiptap-ui/heading-button";
import { ListButton } from "../tiptap-ui/list-button";
import { LinkButton } from "../tiptap-ui/link-button/link-button";
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list';
import { Link } from '@tiptap/extension-link';

import { Underline } from '@tiptap/extension-underline'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'

import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// estilos sass
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  noBorder = false,
  expandable = false,
  title = "Editor de texto",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noBorder?: boolean;
  expandable?: boolean;
  title?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit, 
      TaskList, 
      TaskItem.configure({ nested: true }), 
      Underline, 
      Superscript, 
      Subscript,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[250px] focus:outline-none px-3 py-2",
          noBorder ? "border-none" : "border border-input rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus-visible:ring-ring",
          isExpanded ? "flex-1 min-h-[500px] h-full" : "max-w-[950px]"
        ),
      },
    },
  });

  const toolbar = (
    <div className="toolbar flex items-center flex-wrap gap-2 mb-2 p-2 border border-input rounded-md max-w-fit bg-background">
      <div className="tiptap-button-group flex flex-wrap gap-1" data-orientation="horizontal">
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
        <LinkButton />
      </div>
      {expandable && !isExpanded && (
        <Button 
          type="button"
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 ml-2 border-l pl-2" 
          onClick={() => setIsExpanded(true)}
          title="Ampliar editor"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const editorContent = <EditorContent editor={editor} placeholder={placeholder} />;

  return (
    <div className="rich-text-editor h-full flex flex-col">
      <EditorContext.Provider value={{ editor }}>
        {!isExpanded ? (
          <>
            {toolbar}
            {editorContent}
          </>
        ) : (
          <>
            {/* Mantener el editor en el DOM pero oculto si se prefiere para preservar estado, 
                pero con Tiptap es mejor un renderizado condicional si preservamos el objeto 'editor' */}
            <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
              <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-background">
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                  </div>
                  <div className="p-2 border-b bg-background sticky top-0 z-10 flex justify-center">
                    {toolbar}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 min-h-0 bg-background">
                    <div className="mx-auto w-full prose dark:prose-invert max-w-none">
                      {editorContent}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </EditorContext.Provider>
    </div>
  );
};
