"use client";

/**
 * SortableList — Generic drag-and-drop sortable list.
 * Reusable across any module (products, projects, tasks, etc.)
 *
 * Usage:
 *   <SortableList
 *     items={tasks}
 *     onReorder={(reordered) => handleReorder(reordered)}
 *     renderItem={(item, dragHandle) => (
 *       <div className="flex items-center gap-2">
 *         {dragHandle}
 *         <span>{item.title}</span>
 *       </div>
 *     )}
 *   />
 *
 * Each item must have an `id: number` field.
 */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

export interface SortableItem {
  id: number;
}

interface SortableRowProps<T extends SortableItem> {
  item: T;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}

function SortableRow<T extends SortableItem>({
  item,
  renderItem,
}: SortableRowProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const dragHandle = (
    <button
      type="button"
      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded"
      {...attributes}
      {...listeners}
      aria-label="Arrastrar para reordenar"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, dragHandle)}
    </div>
  );
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (reorderedItems: T[]) => void;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
