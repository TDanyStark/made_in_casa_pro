"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import {
  ProjectDetailType,
  ProjectTaskType,
  ProjectAdjustmentType,
  UserRole,
  TaskQuoteType,
} from "@/lib/definitions";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectNotesEditor } from "./ProjectNotesEditor";
import { ProjectInfoTab } from "./ProjectInfoTab";
import { CollaboratorTasksList } from "./CollaboratorTasksList";
import { SubmitQuoteModal } from "@/components/quotes/SubmitQuoteModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, HardDrive, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  projectId: number;
  project: ProjectDetailType;
  tasks: ProjectTaskType[];
  invitedTaskIds: number[];
  userRole: UserRole;
  currentUserId?: number;
}

export function CollaboratorProjectView({
  projectId,
  project,
  tasks,
  invitedTaskIds,
  currentUserId,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<ProjectTaskType | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  // ── Adjustments (versions) ──────────────────────────────────────────────────
  const { data: adjustments = [], isLoading: adjustmentsLoading } = useQuery({
    queryKey: ["project-adjustments", projectId],
    queryFn: async () => {
      const res = await get<ProjectAdjustmentType[]>(`projects/${projectId}/adjustments`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  // ── Collaborator quotes ─────────────────────────────────────────────────────
  const { data: quoteData, isLoading: quotesLoading } = useQuery({
    queryKey: ["collaborator-project-quotes", projectId, currentUserId],
    queryFn: async () => {
      const res = await get<{ quotes: TaskQuoteType[] }>(`projects/${projectId}/collaborator-quotes`);
      return res.ok ? res.data : null;
    },
    staleTime: 1000 * 60,
  });

  const submittedQuotes = quoteData?.quotes ?? [];

  const handleOpenQuoteModal = (task: ProjectTaskType) => {
    setSelectedTask(task);
    setQuoteModalOpen(true);
  };

  const handleQuoteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["collaborator-project-quotes", projectId, currentUserId] });
  };

  if (adjustmentsLoading || quotesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Group tasks by adjustment_id (null → version 1 / original)
  const tasksByAdjustment = (adjustmentId: number | null) =>
    tasks.filter((t) => {
      if (adjustmentId === null) return t.adjustment_id === null;
      return t.adjustment_id === adjustmentId;
    });

  // Show newest version first (same as ProjectAdjustmentsTab)
  const allVersions = [...adjustments].reverse();

  const totalTasks = tasks.length;

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tareas ({totalTasks})</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="info">Información</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <div className="space-y-4">
            {allVersions.map((adj, index) => (
              <CollaboratorVersionAccordion
                key={adj.id}
                adjustment={adj}
                isInitiallyExpanded={index === 0}
                tasks={tasksByAdjustment(adj.id)}
                invitedTaskIds={invitedTaskIds}
                submittedQuotes={submittedQuotes}
                onQuoteTask={handleOpenQuoteModal}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <ProjectNotesEditor
            projectId={projectId}
            initialContent={project.notes ?? ""}
            readOnly={true}
          />
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <ProjectInfoTab project={project} canEdit={false} />
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <SubmitQuoteModal
          isOpen={quoteModalOpen}
          onClose={() => {
            setQuoteModalOpen(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.id}
          projectId={projectId}
          taskTitle={selectedTask.title}
          projectName={project.title}
          onSuccess={handleQuoteSuccess}
        />
      )}
    </div>
  );
}

// ─── Version Accordion ────────────────────────────────────────────────────────

interface AccordionProps {
  adjustment: ProjectAdjustmentType;
  isInitiallyExpanded: boolean;
  tasks: ProjectTaskType[];
  invitedTaskIds: number[];
  submittedQuotes: TaskQuoteType[];
  onQuoteTask: (task: ProjectTaskType) => void;
}

function CollaboratorVersionAccordion({
  adjustment,
  isInitiallyExpanded,
  tasks,
  invitedTaskIds,
  submittedQuotes,
  onQuoteTask,
}: AccordionProps) {
  const [expanded, setExpanded] = useState(isInitiallyExpanded);

  const isCompleted = adjustment.status === "completed";
  const label =
    adjustment.version_number === 1
      ? "Versión 1 (Original)"
      : `Versión ${adjustment.version_number}`;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="text-base font-semibold">{label}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span
              className={
                isCompleted
                  ? "text-green-600 dark:text-green-400 font-medium"
                  : "text-amber-600 dark:text-amber-400 font-medium"
              }
            >
              {isCompleted ? "Completado" : "Activo"}
            </span>
            <span>•</span>
            <span>
              Creado:{" "}
              {format(new Date(adjustment.created_at), "MMM d, yyyy", { locale: es })}
            </span>
            {adjustment.completed_at && (
              <>
                <span>•</span>
                <span>
                  Finalizado:{" "}
                  {format(new Date(adjustment.completed_at), "MMM d, yyyy", { locale: es })}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {adjustment.drive_folder_url && (
            <Button
              variant="outline"
              size="sm"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={adjustment.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                Drive
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
          )}
          <div className="p-1 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t">
          {adjustment.notes && (
            <div className="px-5 pt-4 pb-3 border-b bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Notas del ajuste
              </p>
              <div
                className="text-sm prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: adjustment.notes }}
              />
            </div>
          )}

          <div className="p-4">
            <CollaboratorTasksList
              tasks={tasks}
              invitedTaskIds={invitedTaskIds}
              submittedQuotes={submittedQuotes}
              onQuoteTask={onQuoteTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}
