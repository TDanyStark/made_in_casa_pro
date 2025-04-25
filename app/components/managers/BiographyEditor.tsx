"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "../clients/RichTextEditor";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

type BiographyEditorProps = {
  initialContent: string;
};

export function BiographyEditor({ initialContent }: BiographyEditorProps) {
  const params = useParams<{ id: string }>();
  const [content, setContent] = useState(initialContent || "");
  const [originalContent, setOriginalContent] = useState(initialContent || "");
  const [isChanged, setIsChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if content has changed from original
    setIsChanged(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    if (!params.id || !isChanged) return;
    
    setIsSubmitting(true);
    
    try {
      // Make API request to update biography
      const response = await fetch(`/api/managers/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          biography: content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar la biografía");
      }

      // Update original content to match new content
      setOriginalContent(content);
      setIsChanged(false);
      
      // Show success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
      toast.success("Biografía actualizada correctamente");
    } catch (error) {
      console.error("Error updating biography:", error);
      toast.error(`Error al actualizar la biografía: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="biography-editor">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Biografía</h2>
        {isChanged && (
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting || !isChanged}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : showSuccess ? (
              <Check className="h-4 w-4" />
            ) : null}
            {isSubmitting ? "Guardando..." : showSuccess ? "¡Guardado!" : "Guardar cambios"}
          </Button>
        )}
      </div>
      
      <RichTextEditor 
        value={content}
        onChange={setContent}
        placeholder="Añade información biográfica del gerente..."
        noBorder={true}
      />
    </div>
  );
}

export default BiographyEditor;