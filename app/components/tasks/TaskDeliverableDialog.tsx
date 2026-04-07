"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectTaskType } from "@/lib/definitions";
import { Eye, ExternalLink, FileText, Link as LinkIcon } from "lucide-react";

interface TaskDeliverableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
}

export function TaskDeliverableDialog({
  open,
  onOpenChange,
  task,
}: TaskDeliverableDialogProps) {
  if (!task) return null;

  const hasDeliveryLink = Boolean(task.delivery_url?.trim());
  const hasDeliveryNotes = Boolean(task.delivery_notes?.trim());
  const hasDeliverable = hasDeliveryLink || hasDeliveryNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="text-muted-foreground" />
            Ver entregable
          </DialogTitle>
          <DialogDescription>
            Información de entrega registrada para la tarea <span className="font-medium text-foreground">{task.title}</span>.
          </DialogDescription>
        </DialogHeader>

        {!hasDeliverable ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="text-muted-foreground" />
                Sin entregable registrado
              </CardTitle>
              <CardDescription>
                Esta tarea todavía no tiene enlace ni notas de entrega.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LinkIcon className="text-muted-foreground" />
                  Enlace de entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasDeliveryLink ? (
                  <div className="flex flex-col gap-3">
                    <Badge variant="secondary">Disponible</Badge>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm break-all">
                      {task.delivery_url}
                    </div>
                    <div>
                      <Button asChild variant="outline" size="sm">
                        <a href={task.delivery_url!} target="_blank" rel="noreferrer">
                          <ExternalLink data-icon="inline-start" />
                          Abrir enlace
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No se registró enlace de entrega.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="text-muted-foreground" />
                  Notas de entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasDeliveryNotes ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/20 p-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: task.delivery_notes ?? "" }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No se registraron notas de entrega.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
