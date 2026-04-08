"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { post } from "@/lib/services/apiService";
import { QuoteSubmissionSchema, TaskQuoteType } from "@/lib/definitions";
import { minutesToDHM } from "@/lib/utils/time";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, DollarSign } from "lucide-react";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((mod) => mod.RichTextEditor),
  { ssr: false }
);

type QuoteFormValues = z.infer<typeof QuoteSubmissionSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskId: number;
  projectId: number;
  taskTitle: string;
  projectName?: string;
  initialData?: Partial<TaskQuoteType>;
  onSuccess?: (quote: TaskQuoteType) => void;
}

export function SubmitQuoteModal({
  isOpen,
  onClose,
  taskId,
  projectId,
  taskTitle,
  projectName,
  initialData,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(QuoteSubmissionSchema),
    defaultValues: {
      price: initialData?.price || 0,
      delivery_days: 0,
      delivery_hours: 0,
      delivery_minutes: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      // delivery_minutes in the DB stores the TOTAL minutes (days*1440 + hours*60 + mins).
      // Decompose it back to DHM so the form fields show the correct individual values.
      const dhm = initialData?.delivery_minutes
        ? minutesToDHM(initialData.delivery_minutes)
        : { days: 0, hours: 0, minutes: 0 };

      setNotes(initialData?.notes ?? "");
      reset({
        price: initialData?.price || 0,
        delivery_days: dhm.days,
        delivery_hours: dhm.hours,
        delivery_minutes: dhm.minutes,
        notes: "",
      });
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (formValues: QuoteFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await post<TaskQuoteType>(
        `projects/${projectId}/tasks/${taskId}/quotes/submit`,
        {
          ...formValues,
          notes: notes || null,
        }
      );

      if (!res.ok) {
        throw new Error(res.error || "Error al enviar la cotización");
      }

      toast.success("Cotización enviada con éxito");
      if (onSuccess && res.data) {
        onSuccess(res.data);
      }
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar la cotización");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Cotización</DialogTitle>
          <DialogDescription>
            {projectName ? `${projectName} / ` : ""}{taskTitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="price" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Precio (COP)
            </Label>
            <Input
              id="price"
              type="number"
              step="1"
              placeholder="0"
              {...register("price")}
              className={errors.price ? "border-destructive" : ""}
            />
            {errors.price && (
              <p className="text-xs text-destructive">{errors.price.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tiempo de entrega estimado
            </Label>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="days" className="text-xs text-muted-foreground">Días</Label>
                <Input
                  id="days"
                  type="number"
                  placeholder="0"
                  {...register("delivery_days")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hours" className="text-xs text-muted-foreground">Horas</Label>
                <Input
                  id="hours"
                  type="number"
                  placeholder="0"
                  {...register("delivery_hours")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minutes" className="text-xs text-muted-foreground">Minutos</Label>
                <Input
                  id="minutes"
                  type="number"
                  placeholder="0"
                  {...register("delivery_minutes")}
                />
              </div>
            </div>
            {errors.delivery_days && (
              <p className="text-xs text-destructive">{errors.delivery_days.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notas adicionales (opcional)</Label>
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              placeholder="Detalles sobre tu propuesta, requerimientos, etc."
              noBorder={true}
              expandable={false}
              title="Notas de la cotización"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Cotización
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
