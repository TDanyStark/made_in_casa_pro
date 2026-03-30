"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Check, Maximize2 } from "lucide-react";
import { patch } from "@/lib/services/apiService";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((mod) => mod.RichTextEditor),
  { loading: () => <Skeleton className="h-[300px] w-full" />, ssr: false }
);

interface Props {
  projectId: number;
  initialContent: string;
}

export function ProjectNotesEditor({ projectId, initialContent }: Props) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [isChanged, setIsChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setIsChanged(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    if (!isChanged) return;
    setIsSubmitting(true);
    try {
      const res = await patch(`projects/${projectId}`, { notes: content });
      if (!res.ok) throw new Error(res.error ?? "Error al guardar");
      setOriginalContent(content);
      setIsChanged(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Notas guardadas");
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "desconocido"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Notas del proyecto</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ampliar editor">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[90vw] h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Notas del proyecto</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Agrega notas, objetivos o contexto del proyecto..."
                  noBorder={true}
                />
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={isSubmitting || !isChanged} className="gap-2">
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : showSuccess ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {isSubmitting ? "Guardando..." : showSuccess ? "¡Guardado!" : "Guardar cambios"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {isChanged && (
          <Button onClick={handleSave} disabled={isSubmitting} size="sm" className="gap-2">
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : showSuccess ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {isSubmitting ? "Guardando..." : showSuccess ? "¡Guardado!" : "Guardar cambios"}
          </Button>
        )}
      </div>
      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Agrega notas, objetivos o contexto del proyecto..."
        noBorder={true}
      />
    </div>
  );
}
