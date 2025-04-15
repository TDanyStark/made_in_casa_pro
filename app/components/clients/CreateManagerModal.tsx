"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Bold, List } from "lucide-react";
import { Heading as HeadingIcon } from "lucide-react";
import useItemMutations from "@/hooks/useItemsMutation";

// TipTap imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';

const formSchema = z.object({
  id: z.number().int(),
  client_id: z.coerce.number().int().positive("Se requiere un cliente válido"),
  name: z.string().nonempty("El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido").nonempty("El correo electrónico es obligatorio"),
  phone: z.string().nonempty("El teléfono es obligatorio"),
  biography: z.string().nonempty("La biografía es obligatoria"),
});

type ManagerFormData = z.infer<typeof formSchema>;

// Rich Text Editor Component
const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'min-h-[150px] border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus-visible:ring-ring',
      },
    },
  });

  return (
    <div className="rich-text-editor">
      <div className="toolbar flex items-center gap-2 mb-2 p-2 border border-input rounded-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`p-1 ${editor?.isActive('bold') ? 'bg-muted' : ''}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`p-1 ${editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}`}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <HeadingIcon size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`p-1 ${editor?.isActive('bulletList') ? 'bg-muted' : ''}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </Button>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
};

export function CreateManagerModal({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const form = useForm<ManagerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: 0,
      client_id: clientId,
      name: "",
      email: "",
      phone: "",
      biography: "",
    },
  });

  const router = useRouter();
  const { createItem } = useItemMutations<ManagerFormData>("managers");

  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(
      data,
      {
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
        onError: (error) => {
          console.error("Error creando gerente:", error);
        },
      }
    );
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        client_id: clientId,
        name: "",
        email: "",
        phone: "",
        biography: "",
      });
    }
  }, [open, form, clientId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Crear Gerente</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]"> {/* Increased width for better editor experience */}
        <DialogHeader>
          <DialogTitle>Crear Gerente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-manager"
            onSubmit={handleSubmit}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del gerente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 234 567 8901" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="biography"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biografía</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Información sobre el gerente..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={createItem.isPending} className="flex gap-2">
                {createItem.isPending && <Loader2 className="animate-spin mr-2" />}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateManagerModal;
