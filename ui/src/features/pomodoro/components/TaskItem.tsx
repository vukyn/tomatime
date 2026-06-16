import { Box, Flex, HStack, Menu, Portal, Text, chakra } from "@chakra-ui/react";
import { LuCheck, LuEllipsisVertical, LuPencil, LuRotateCcw, LuTrash2 } from "react-icons/lu";
import type { Task } from "@/features/pomodoro/types";

interface TaskItemProps {
	task: Task;
	active: boolean;
	onActivate: () => void;
	onToggleDone: () => void;
	onEdit: () => void;
	onClearPomodoros: () => void;
	onDelete: () => void;
}

// A single clay todo row: checkbox, name/note, completed/estimate chip, and the
// 3-dot overflow menu (Edit · Clear active pomodoros · Delete).
//
// The row itself is a clickable/focusable control: clicking (or Enter/Space when
// focused) binds the task to the timer as the active task; the active row gets a
// raised clay surface + tomato accent border. Clicks on the checkbox / overflow
// menu stop propagation so they keep their own behavior and never toggle active.
export function TaskItem({
	task,
	active,
	onActivate,
	onToggleDone,
	onEdit,
	onClearPomodoros,
	onDelete,
}: TaskItemProps) {
	const chipBg = task.done
		? "clay.basil100"
		: active
			? undefined
			: "clay.tomato100";
	const chipColor = task.done ? "clay.basil600" : active ? "white" : "clay.tomato700";

	// Done tasks can't drive the timer, so they aren't activatable/focusable.
	const activatable = !task.done;

	const handleActivate = () => {
		if (activatable) onActivate();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (!activatable) return;
		// Only handle keys originating on the row itself, not bubbled from the
		// checkbox / menu trigger (which manage their own keys).
		if (event.target !== event.currentTarget) return;
		if (event.key === "Enter" || event.key === " " || event.code === "Space") {
			event.preventDefault();
			onActivate();
		}
	};

	return (
		<Flex
			as="li"
			data-task-row
			role={activatable ? "button" : undefined}
			tabIndex={activatable ? 0 : undefined}
			aria-pressed={activatable ? active : undefined}
			aria-label={activatable ? `Set "${task.name}" as the active task` : undefined}
			onClick={handleActivate}
			onKeyDown={handleKeyDown}
			position="relative"
			align="center"
			gap="16px"
			bg="clay.surface"
			borderRadius="clayMd"
			boxShadow={active ? "clayRaised" : "claySoft"}
			border="2px solid"
			borderColor={active ? "clay.tomato500" : "transparent"}
			px="24px"
			py="16px"
			cursor={activatable ? "pointer" : "default"}
			transition="box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease"
			_hover={{ transform: "translateY(-1px)", boxShadow: "clayRaised" }}
			_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "3px" }}
		>
			{/* round clay checkbox */}
			<chakra.button
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					onToggleDone();
				}}
				aria-label={task.done ? "Mark incomplete" : "Mark complete"}
				flexShrink={0}
				w="30px"
				h="30px"
				borderRadius="50%"
				display="grid"
				placeItems="center"
				cursor="pointer"
				transition="all 160ms ease"
				bg={task.done ? undefined : "clay.press"}
				bgGradient={task.done ? "to-br" : undefined}
				gradientFrom={task.done ? "clay.basil500" : undefined}
				gradientTo={task.done ? "clay.basil600" : undefined}
				boxShadow={task.done ? "claySoft" : "clayPressed"}
				color={task.done ? "white" : "transparent"}
				_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "3px" }}
			>
				{task.done && <LuCheck size={16} strokeWidth={3} />}
			</chakra.button>

			{/* body — min-width:0 lets the name truncate */}
			<Box flex="1" minW="0">
				<Text
					fontWeight="700"
					fontSize="1.02rem"
					color={task.done ? "clay.ink400" : "clay.ink900"}
					truncate
					title={task.name}
					textDecoration={task.done ? "line-through" : undefined}
				>
					{task.name}
				</Text>
				{task.note && (
					<Text
						fontSize="0.85rem"
						color={task.done ? "clay.ink400" : "clay.ink600"}
						mt="2px"
						truncate
						title={task.note}
						textDecoration={task.done ? "line-through" : undefined}
					>
						{task.note}
					</Text>
				)}
			</Box>

			{/* pomodoro chip: completed / estimated */}
			<HStack
				flexShrink={0}
				gap="4px"
				fontFamily="heading"
				fontWeight="800"
				fontSize="0.9rem"
				px="12px"
				py="8px"
				borderRadius="clayPill"
				bg={chipBg}
				bgGradient={active && !task.done ? "to-br" : undefined}
				gradientFrom={active && !task.done ? "clay.tomato500" : undefined}
				gradientTo={active && !task.done ? "clay.tomato600" : undefined}
				boxShadow={active && !task.done ? "tomatoRaised" : undefined}
				color={chipColor}
				css={{ fontVariantNumeric: "tabular-nums" }}
				title={`${task.completed} of ${task.estimate} pomodoros done`}
			>
				<Text as="span">
					{task.completed}/{task.estimate}
				</Text>
				<Text as="span">🍅</Text>
			</HStack>

			{/* overflow menu */}
			<Menu.Root>
				<Menu.Trigger asChild>
					<chakra.button
						type="button"
						aria-label="Task options"
						onClick={(event) => event.stopPropagation()}
						flexShrink={0}
						w="32px"
						h="32px"
						borderRadius="claySm"
						display="grid"
						placeItems="center"
						cursor="pointer"
						color="clay.ink400"
						_hover={{ color: "clay.ink900", bg: "clay.press" }}
						_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "2px" }}
						css={{ '&[data-state="open"]': { color: "var(--chakra-colors-clay-tomato600)", background: "var(--chakra-colors-clay-press)" } }}
					>
						<LuEllipsisVertical size={18} />
					</chakra.button>
				</Menu.Trigger>
				<Portal>
					<Menu.Positioner>
						<Menu.Content
							minW="220px"
							bg="clay.surfaceHi"
							borderRadius="clayMd"
							boxShadow="clayRaised"
							p="8px"
						>
							<Menu.Item value="edit" onClick={onEdit} borderRadius="claySm" py="12px" px="16px" _hover={{ bg: "clay.press" }}>
								<LuPencil /> Edit
							</Menu.Item>
							<Menu.Item value="clear" onClick={onClearPomodoros} borderRadius="claySm" py="12px" px="16px" _hover={{ bg: "clay.press" }}>
								<LuRotateCcw />
								<Box>
									<Text>Clear active pomodoros</Text>
									<Text fontSize="0.78rem" color="clay.ink400">
										Reset completed count to 0
									</Text>
								</Box>
							</Menu.Item>
							<Menu.Separator borderColor="clay.line" my="4px" />
							<Menu.Item
								value="delete"
								onClick={onDelete}
								color="clay.tomato700"
								borderRadius="claySm"
								py="12px"
								px="16px"
								_hover={{ bg: "clay.tomato100" }}
							>
								<LuTrash2 /> Delete
							</Menu.Item>
						</Menu.Content>
					</Menu.Positioner>
				</Portal>
			</Menu.Root>
		</Flex>
	);
}
