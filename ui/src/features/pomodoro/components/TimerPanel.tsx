import { Box, Flex, HStack, IconButton, Text, chakra } from "@chakra-ui/react";
import { LuMinus, LuPlus } from "react-icons/lu";
import {
	INTERVAL_CLOCK_LABEL,
	INTERVAL_LABEL,
	INTERVAL_ORDER,
} from "@/features/pomodoro/constants";
import type { IntervalKind, Task } from "@/features/pomodoro/types";
import type { UseTimerReturn } from "@/features/pomodoro/useTimer";
import { formatCountdown } from "@/utils/time";

interface TimerPanelProps {
	timer: UseTimerReturn;
	activeTask?: Task;
}

// Section 1 — the clay Pomodoro timer: interval tabs, countdown ring, context
// label, and the idle/running control sets.
export function TimerPanel({ timer, activeTask }: TimerPanelProps) {
	const {
		interval,
		running,
		remaining,
		progress,
		selectInterval,
		toggle,
		skip,
		incrementMinutes,
		decrementMinutes,
		atMinMinutes,
		atMaxMinutes,
	} = timer;

	return (
		<Box
			as="section"
			aria-label="Pomodoro timer"
			bg="clay.surface"
			borderRadius="clayLg"
			boxShadow="clayRaised"
			px={{ base: "20px", sm: "24px" }}
			pt="32px"
			pb="48px"
			display="flex"
			flexDirection="column"
			alignItems="center"
			gap="32px"
		>
			<IntervalTabs value={interval} onSelect={selectInterval} disabled={running} />

			<CountdownRing
				progress={progress}
				countdown={formatCountdown(remaining)}
				label={INTERVAL_CLOCK_LABEL[interval]}
			/>

			<TimerContext task={activeTask} />

			{running ? (
				<RunningControls onStop={toggle} onSkip={skip} />
			) : (
				<IdleControls
					onStart={toggle}
					onIncrement={incrementMinutes}
					onDecrement={decrementMinutes}
					decrementDisabled={atMinMinutes || interval !== "pomodoro"}
					incrementDisabled={atMaxMinutes || interval !== "pomodoro"}
				/>
			)}
		</Box>
	);
}

// --- Segmented clay tab control (recessed trough, raised active pill) ---------
function IntervalTabs({
	value,
	onSelect,
	disabled,
}: {
	value: IntervalKind;
	onSelect: (kind: IntervalKind) => void;
	disabled: boolean;
}) {
	return (
		<HStack
			role="tablist"
			aria-label="Interval"
			bg="clay.press"
			borderRadius="clayPill"
			boxShadow="clayPressed"
			p="4px"
			gap="4px"
		>
			{INTERVAL_ORDER.map((kind) => {
				const selected = kind === value;
				return (
					<chakra.button
						key={kind}
						type="button"
						role="tab"
						aria-selected={selected}
						disabled={disabled && !selected}
						onClick={() => onSelect(kind)}
						cursor="pointer"
						fontFamily="heading"
						fontWeight="800"
						fontSize="0.95rem"
						px="24px"
						py="12px"
						borderRadius="clayPill"
						transition="all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)"
						bg={selected ? "clay.surfaceHi" : "transparent"}
						color={selected ? "clay.tomato600" : "clay.ink600"}
						boxShadow={selected ? "claySoft" : "none"}
						_hover={{ color: selected ? "clay.tomato600" : "clay.ink900" }}
						_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "3px" }}
						_disabled={{ opacity: 0.5, cursor: "not-allowed" }}
					>
						{INTERVAL_LABEL[kind]}
					</chakra.button>
				);
			})}
		</HStack>
	);
}

// --- Countdown ring (conic-gradient progress arc over a recessed groove) ------
function CountdownRing({
	progress,
	countdown,
	label,
}: {
	progress: number;
	countdown: string;
	label: string;
}) {
	const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
	return (
		<Box
			position="relative"
			w={{ base: "230px", sm: "268px" }}
			h={{ base: "230px", sm: "268px" }}
			display="grid"
			placeItems="center"
		>
			{/* progress arc */}
			<Box
				position="absolute"
				inset="0"
				borderRadius="50%"
				boxShadow="claySoft"
				aria-hidden="true"
				style={{
					background: `conic-gradient(var(--chakra-colors-clay-tomato600) 0% ${pct}%, var(--chakra-colors-clay-press) ${pct}% 100%)`,
				}}
			/>
			{/* inner well so only a thick ring band shows */}
			<Box
				position="absolute"
				inset="20px"
				borderRadius="50%"
				bg="clay.surface"
				boxShadow="clayPressed"
				aria-hidden="true"
			/>
			<Flex position="relative" zIndex={1} direction="column" align="center" gap="4px">
				<Text
					fontFamily="heading"
					fontWeight="900"
					fontSize={{ base: "3.5rem", sm: "4.5rem" }}
					letterSpacing="-0.03em"
					color="clay.ink900"
					lineHeight="1"
					css={{ fontVariantNumeric: "tabular-nums" }}
				>
					{countdown}
				</Text>
				<Text
					fontWeight="700"
					fontSize="0.85rem"
					letterSpacing="0.08em"
					textTransform="uppercase"
					color="clay.ink600"
				>
					{label}
				</Text>
			</Flex>
		</Box>
	);
}

// --- Timer context label (which task + pomodoros run, or "Time to focus") -----
function TimerContext({ task }: { task?: Task }) {
	return (
		<HStack
			maxW="320px"
			justify="center"
			gap="8px"
			bg="clay.press"
			boxShadow="clayPressed"
			borderRadius="clayPill"
			px="16px"
			py="8px"
			fontFamily="heading"
			fontWeight="800"
			fontSize="0.95rem"
			color="clay.ink900"
		>
			{task ? (
				<>
					<Text maxW="180px" truncate title={task.name}>
						{task.name}
					</Text>
					<Text color="clay.ink400">·</Text>
					<Text
						as="span"
						color="clay.tomato700"
						display="inline-flex"
						alignItems="center"
						gap="4px"
						css={{ fontVariantNumeric: "tabular-nums" }}
					>
						🍅 {task.completed}
					</Text>
				</>
			) : (
				<Text color="clay.ink600">Time to focus</Text>
			)}
		</HStack>
	);
}

// --- Idle controls: [ − ] [ START ] [ + ] ------------------------------------
function IdleControls({
	onStart,
	onIncrement,
	onDecrement,
	decrementDisabled,
	incrementDisabled,
}: {
	onStart: () => void;
	onIncrement: () => void;
	onDecrement: () => void;
	decrementDisabled: boolean;
	incrementDisabled: boolean;
}) {
	return (
		<HStack gap="24px" align="center" justify="center">
			<ClayIconButton
				aria-label="Decrease minutes"
				onClick={onDecrement}
				disabled={decrementDisabled}
			>
				<LuMinus />
			</ClayIconButton>

			<PrimaryCta onClick={onStart} aria-label="Start timer (or press Space)">
				START
			</PrimaryCta>

			<ClayIconButton
				aria-label="Increase minutes"
				onClick={onIncrement}
				disabled={incrementDisabled}
			>
				<LuPlus />
			</ClayIconButton>
		</HStack>
	);
}

// --- Running controls: [ STOP ] [ ▸▸ skip ] (skip to the RIGHT of stop) -------
function RunningControls({ onStop, onSkip }: { onStop: () => void; onSkip: () => void }) {
	return (
		<HStack gap="24px" align="center" justify="center">
			{/* spacer keeps STOP centered, balancing the skip button on the right */}
			<Box w="56px" aria-hidden="true" />

			<PrimaryCta variant="stop" onClick={onStop} aria-label="Stop timer (or press Space)">
				STOP
			</PrimaryCta>

			<ClayIconButton aria-label="Skip to next interval" onClick={onSkip}>
				<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
					<path d="M5 5v14l8-7-8-7Zm9 0v14l8-7-8-7Z" />
				</svg>
			</ClayIconButton>
		</HStack>
	);
}

// --- Shared clay control primitives ------------------------------------------
function ClayIconButton({
	children,
	disabled,
	onClick,
	"aria-label": ariaLabel,
}: {
	children: React.ReactNode;
	disabled?: boolean;
	onClick: () => void;
	"aria-label": string;
}) {
	return (
		<IconButton
			aria-label={ariaLabel}
			onClick={onClick}
			disabled={disabled}
			unstyled
			w="56px"
			h="56px"
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
			css={{ "& svg": { width: "24px", height: "24px" } }}
		>
			{children}
		</IconButton>
	);
}

function PrimaryCta({
	children,
	onClick,
	variant = "start",
	"aria-label": ariaLabel,
}: {
	children: React.ReactNode;
	onClick: () => void;
	variant?: "start" | "stop";
	"aria-label": string;
}) {
	const stop = variant === "stop";
	return (
		<chakra.button
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			cursor="pointer"
			fontFamily="heading"
			fontWeight="900"
			fontSize="1.15rem"
			letterSpacing="0.06em"
			minW="168px"
			h="64px"
			px="32px"
			borderRadius="clayPill"
			transition="transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms ease"
			color={stop ? "clay.tomato700" : "white"}
			bg={stop ? "clay.press" : undefined}
			bgGradient={stop ? undefined : "to-br"}
			gradientFrom={stop ? undefined : "clay.tomato500"}
			gradientTo={stop ? undefined : "clay.tomato600"}
			boxShadow={stop ? "clayPressed" : "tomatoRaised"}
			_hover={stop ? undefined : { transform: "translateY(-2px)" }}
			_active={{ transform: "scale(0.96)" }}
			_focusVisible={{ outline: "4px solid", outlineColor: "clay.tomato700", outlineOffset: "4px" }}
		>
			{children}
		</chakra.button>
	);
}
