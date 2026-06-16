"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Flex, HStack, IconButton, Input, Text, Textarea, chakra } from "@chakra-ui/react";
import { LuMinus, LuPlus, LuX } from "react-icons/lu";
import { MAX_ESTIMATE, MIN_ESTIMATE } from "@/features/pomodoro/constants";
import type { Task, TaskDraft } from "@/features/pomodoro/types";

interface TaskFormProps {
	// When set, the form is in edit mode and pre-filled from this task.
	editing?: Task;
	onSubmit: (draft: TaskDraft) => void;
	onCancelEdit?: () => void;
	// When provided (create mode only), renders the card header with a close (×)
	// button that collapses the form back to the AddTaskTrigger.
	onClose?: () => void;
}

const clampEstimate = (value: number) =>
	Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, value));

// Clay create/edit form: task name, estimate stepper, progressive-disclosure note.
// State is seeded lazily from `editing`; the parent remounts this component (via
// a changing `key`) when entering/leaving edit mode or after a successful add, so
// no effect-driven state sync is needed.
export function TaskForm({ editing, onSubmit, onCancelEdit, onClose }: TaskFormProps) {
	const [name, setName] = useState(() => editing?.name ?? "");
	const [estimate, setEstimate] = useState(() => editing?.estimate ?? 4);
	const [note, setNote] = useState(() => editing?.note ?? "");
	const [noteOpen, setNoteOpen] = useState(() => Boolean(editing?.note));
	const nameRef = useRef<HTMLInputElement>(null);

	// Autofocus the name field on mount — when editing an existing task or when
	// the create form is expanded from the trigger (the parent remounts this
	// component via a changing `key`, so on-mount focus covers both cases).
	useEffect(() => {
		nameRef.current?.focus();
	}, []);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			nameRef.current?.focus();
			return;
		}
		onSubmit({ name, estimate: clampEstimate(estimate), note });
		if (!editing) {
			setName("");
			setEstimate(4);
			setNote("");
			setNoteOpen(false);
		}
	};

	return (
		<Box
			as="form"
			aria-label={editing ? "Edit task" : "Add a task"}
			onSubmit={handleSubmit}
			bg="clay.surface"
			borderRadius="clayMd"
			boxShadow="clayRaised"
			p="24px"
			position="relative"
			display="flex"
			flexDirection="column"
			gap="16px"
		>
			{onClose && (
				<Flex align="center" justify="space-between">
					<Text fontFamily="heading" fontWeight="900" fontSize="1.05rem" color="clay.ink900">
						New task
					</Text>
					<IconButton
						type="button"
						aria-label="Close"
						onClick={onClose}
						unstyled
						w="36px"
						h="36px"
						borderRadius="50%"
						bg="clay.press"
						boxShadow="claySoft"
						color="clay.ink600"
						display="grid"
						placeItems="center"
						cursor="pointer"
						transition="transform 160ms ease, color 140ms ease"
						_hover={{ color: "clay.tomato600", transform: "translateY(-1px)" }}
						_active={{ boxShadow: "clayPressed", transform: "scale(0.92)" }}
						_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "3px" }}
					>
						<LuX size={18} />
					</IconButton>
				</Flex>
			)}

			<Field label="Task name" htmlFor="task-name">
				<ClayInput
					ref={nameRef}
					id="task-name"
					type="text"
					placeholder="What are you working on?"
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</Field>

			<Flex gap="16px" align="flex-end" direction={{ base: "column", sm: "row" }}>
				<Field label="Est. pomodoros">
					<EstimateStepper value={estimate} onChange={(next) => setEstimate(clampEstimate(next))} />
				</Field>

				<Box flex="1" alignSelf="flex-end" w={{ base: "100%", sm: "auto" }}>
					{!noteOpen && (
						<chakra.button
							type="button"
							onClick={() => setNoteOpen(true)}
							aria-expanded={noteOpen}
							aria-controls="task-note"
							alignSelf="flex-start"
							color="clay.tomato600"
							fontWeight="700"
							fontSize="0.9rem"
							cursor="pointer"
							display="inline-flex"
							alignItems="center"
							gap="4px"
							py="4px"
						>
							<LuPlus size={16} /> Add note
						</chakra.button>
					)}
				</Box>
			</Flex>

			{noteOpen && (
				<Field
					label="Note"
					htmlFor="task-note"
					optional
				>
					<ClayTextarea
						id="task-note"
						placeholder="Add context, links, or sub-steps…"
						value={note}
						onChange={(event) => setNote(event.target.value)}
					/>
				</Field>
			)}

			<HStack justify="flex-end" gap="12px">
				{editing && onCancelEdit && (
					<chakra.button
						type="button"
						onClick={onCancelEdit}
						fontFamily="heading"
						fontWeight="800"
						fontSize="0.95rem"
						color="clay.ink600"
						px="20px"
						py="12px"
						borderRadius="clayPill"
						cursor="pointer"
						_hover={{ color: "clay.ink900" }}
					>
						Cancel
					</chakra.button>
				)}
				<chakra.button
					type="submit"
					fontFamily="heading"
					fontWeight="800"
					fontSize="0.95rem"
					color="white"
					px="32px"
					py="12px"
					borderRadius="clayPill"
					bgGradient="to-br"
					gradientFrom="clay.tomato500"
					gradientTo="clay.tomato600"
					boxShadow="tomatoRaised"
					cursor="pointer"
					transition="transform 160ms cubic-bezier(0.34,1.56,0.64,1)"
					_hover={{ transform: "translateY(-2px)" }}
					_active={{ transform: "scale(0.96)" }}
				>
					{editing ? "Save task" : "Add task"}
				</chakra.button>
			</HStack>
		</Box>
	);
}

function Field({
	label,
	htmlFor,
	optional,
	children,
}: {
	label: string;
	htmlFor?: string;
	optional?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Box display="flex" flexDirection="column" gap="8px">
			<chakra.label htmlFor={htmlFor} fontWeight="700" fontSize="0.85rem" color="clay.ink600">
				{label}
				{optional && (
					<Text as="span" color="clay.ink400" fontWeight="400">
						{" "}
						(optional)
					</Text>
				)}
			</chakra.label>
			{children}
		</Box>
	);
}

function EstimateStepper({
	value,
	onChange,
}: {
	value: number;
	onChange: (next: number) => void;
}) {
	return (
		<HStack role="group" aria-label="Estimated pomodoros" gap="12px" align="center">
			<SmallClayButton aria-label="Decrease estimate" onClick={() => onChange(value - 1)} disabled={value <= MIN_ESTIMATE}>
				<LuMinus size={20} />
			</SmallClayButton>
			<Text
				fontFamily="heading"
				fontWeight="900"
				fontSize="1.2rem"
				minW="32px"
				textAlign="center"
				css={{ fontVariantNumeric: "tabular-nums" }}
			>
				{value}
			</Text>
			<SmallClayButton aria-label="Increase estimate" onClick={() => onChange(value + 1)} disabled={value >= MAX_ESTIMATE}>
				<LuPlus size={20} />
			</SmallClayButton>
		</HStack>
	);
}

function SmallClayButton({
	children,
	onClick,
	disabled,
	"aria-label": ariaLabel,
}: {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	"aria-label": string;
}) {
	return (
		<IconButton
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			disabled={disabled}
			unstyled
			w="44px"
			h="44px"
			borderRadius="50%"
			bg="clay.surface"
			boxShadow="claySoft"
			color="clay.ink900"
			display="grid"
			placeItems="center"
			cursor="pointer"
			transition="transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms ease"
			_hover={{ transform: "translateY(-2px)" }}
			_active={{ boxShadow: "clayPressed", transform: "scale(0.94)" }}
			_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "3px" }}
			_disabled={{ opacity: 0.4, cursor: "not-allowed", boxShadow: "clayPressed", transform: "none" }}
		>
			{children}
		</IconButton>
	);
}

const ClayInput = (props: React.ComponentProps<typeof Input>) => (
	<Input
		unstyled
		fontFamily="body"
		fontSize="1rem"
		color="clay.ink900"
		bg="clay.press"
		borderRadius="claySm"
		boxShadow="clayPressed"
		px="16px"
		py="12px"
		w="100%"
		transition="box-shadow 160ms ease"
		_placeholder={{ color: "clay.ink400" }}
		_focus={{ outline: "none", boxShadow: "clayPressed, 0 0 0 3px var(--chakra-colors-clay-tomato100)" }}
		{...props}
	/>
);

const ClayTextarea = (props: React.ComponentProps<typeof Textarea>) => (
	<Textarea
		unstyled
		fontFamily="body"
		fontSize="1rem"
		color="clay.ink900"
		bg="clay.press"
		borderRadius="claySm"
		boxShadow="clayPressed"
		px="16px"
		py="12px"
		w="100%"
		minH="64px"
		resize="vertical"
		transition="box-shadow 160ms ease"
		_placeholder={{ color: "clay.ink400" }}
		_focus={{ outline: "none", boxShadow: "clayPressed, 0 0 0 3px var(--chakra-colors-clay-tomato100)" }}
		{...props}
	/>
);
