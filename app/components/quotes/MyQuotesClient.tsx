"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { TaskQuoteType, TaskQuoteInvitationType } from "@/lib/definitions";
import { formatDHM } from "@/lib/utils/time";
import { SubmitQuoteModal } from "./SubmitQuoteModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Briefcase, 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  Info, 
  PlusCircle, 
  History,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import Link from "next/link";

interface MyQuotesData {
  quotes: TaskQuoteType[];
  invitations: TaskQuoteInvitationType[];
}

const QUOTE_STATUS_CONFIG = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  accepted: { label: "Aceptada", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function MyQuotesClient() {
  const queryClient = useQueryClient();
  const [selectedInvite, setSelectedInvite] = useState<TaskQuoteInvitationType | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<TaskQuoteType | null>(null);

  const { data, isLoading, error } = useQuery<MyQuotesData>({
    queryKey: ["my-quotes"],
    queryFn: async () => {
      const res = await get<MyQuotesData>("my-quotes");
      if (!res.ok) throw new Error(res.error || "Error al obtener cotizaciones");
      return res.data!;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full max-w-[400px]" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-3" />
        <p className="text-muted-foreground font-medium">Ocurrió un error al cargar las cotizaciones</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["my-quotes"] })}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const invitations = data?.invitations || [];
  const quotes = data?.quotes || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="invitations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Pendientes ({invitations.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial ({quotes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invitations">
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
              <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No tienes invitaciones pendientes</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las tareas a las que seas invitado para cotizar aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {invitations.map((inv) => (
                <Card key={inv.id} className="overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="text-base line-clamp-1">{inv.task_title}</CardTitle>
                    <CardDescription>{inv.project_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Invitado el: {new Date(inv.invited_at).toLocaleDateString()}
                    </div>
                    {inv.invited_by_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        Invitado por: {inv.invited_by_name}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-2" 
                      onClick={() => setSelectedInvite(inv)}
                    >
                      Cotizar ahora
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2" 
                      asChild
                    >
                      <Link href={`/my-quotes/projects/${inv.project_id}`}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Ver proyecto
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Aún no has enviado cotizaciones</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu historial de propuestas enviadas se mostrará en esta sección.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quotes.map((quote) => (
                <Card key={quote.id} className="overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base line-clamp-1">{quote.task_title}</CardTitle>
                      <Badge 
                        variant="outline" 
                        className={QUOTE_STATUS_CONFIG[quote.status].className}
                      >
                        {QUOTE_STATUS_CONFIG[quote.status].label}
                      </Badge>
                    </div>
                    <CardDescription>
                      Propuesta enviada el {new Date(quote.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      Precio: ${Number(quote.price).toLocaleString("es-CO")}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Tiempo estimado: {formatDHM(quote.delivery_minutes)}
                    </div>
                    {quote.notes && (
                      <div 
                        className="text-sm text-muted-foreground italic border-t pt-2 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: quote.notes }}
                      />
                    )}
                    {quote.status === "pending" && (
                      <Button 
                        variant="outline" 
                        className="w-full mt-2"
                        onClick={() => setSelectedQuote(quote)}
                      >
                        Actualizar Propuesta
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {selectedInvite && (
        <SubmitQuoteModal
          isOpen={!!selectedInvite}
          onClose={() => setSelectedInvite(null)}
          taskId={selectedInvite.task_id}
          projectId={selectedInvite.project_id!}
          taskTitle={selectedInvite.task_title!}
          projectName={selectedInvite.project_name}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
            queryClient.invalidateQueries({ queryKey: ["my-quotes-count"] });
            setSelectedInvite(null);
          }}
        />
      )}

      {selectedQuote && (
        <SubmitQuoteModal
          isOpen={!!selectedQuote}
          onClose={() => setSelectedQuote(null)}
          taskId={selectedQuote.task_id}
          projectId={selectedQuote.project_id!}
          taskTitle={selectedQuote.task_title!}
          initialData={selectedQuote}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
            queryClient.invalidateQueries({ queryKey: ["my-quotes-count"] });
            setSelectedQuote(null);
          }}
        />
      )}
    </div>
  );
}
