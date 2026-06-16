import { Flex } from "@chakra-ui/react";
import { EmptyState } from "@/features/pomodoro/components/EmptyState";
import { TaskItem } from "@/features/pomodoro/components/TaskItem";
import type { Task } from "@/features/pomodoro/types";

interface TaskListProps {
	tasks: Task[];
	activeTaskId?: string;
	onActivate: (id: string) => void;
	onToggleDone: (id: string) => void;
	onEdit: (task: Task) => void;
	onClearPomodoros: (id: string) => void;
	onDelete: (task: Task) => void;
}

export function TaskList({
	tasks,
	activeTaskId,
	onActivate,
	onToggleDone,
	onEdit,
	onClearPomodoros,
	onDelete,
}: TaskListProps) {
	if (tasks.length === 0) {
		return <EmptyState />;
	}

	return (
		<Flex as="ul" direction="column" gap="12px" listStyleType="none">
			{tasks.map((task) => (
				<TaskItem
					key={task.id}
					task={task}
					active={task.id === activeTaskId}
					onActivate={() => onActivate(task.id)}
					onToggleDone={() => onToggleDone(task.id)}
					onEdit={() => onEdit(task)}
					onClearPomodoros={() => onClearPomodoros(task.id)}
					onDelete={() => onDelete(task)}
				/>
			))}
		</Flex>
	);
}
