"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProjectDetailType, ProjectTaskType, UserRole, TaskQuoteType } from "@/lib/definitions";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectNotesEditor } from "./ProjectNotesEditor";
import { ProjectInfoTab } from "./ProjectInfoTab";
import { CollaboratorTasksList } from "./CollaboratorTasksList";
import { SubmitQuoteModal } from "@/components/quotes/SubmitQuoteModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTaskType | null>(null);

  const { data: quoteData, isLoading: quotesLoading } = useQuery({
    queryKey: ["collaborator-project-quotes", projectId, currentUserId],
    queryFn: async () => {
      const res = await get<{ quotes: TaskQuoteType[] }>(`projects/${projectId}/collaborator-quotes`);
      return res.ok ? res.data : null;
    },
    staleTime: 1000 * 60,
  });

  const submittedQuotes = quoteData?.quotes ?? [];

  const isLoading = quotesLoading;

  const handleOpenQuoteModal = (task: ProjectTaskType) => {
    setSelectedTask(task);
    setQuoteModalOpen(true);
  };

  const handleQuoteSuccess = () => {
    // Refresh quotes data - query will auto-refresh
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">
            Tareas ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="info">Información</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <CollaboratorTasksList
            tasks={tasks}
            invitedTaskIds={invitedTaskIds}
            submittedQuotes={submittedQuotes}
            onQuoteTask={handleOpenQuoteModal}
          />
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
