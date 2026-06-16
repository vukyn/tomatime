"use client";

import { useEffect, useState } from "react";
import { Box, Flex, IconButton, Text, chakra } from "@chakra-ui/react";
import { LuBell, LuBellOff, LuBellRing, LuSettings, LuX } from "react-icons/lu";
import type { UseNotificationsReturn } from "@/features/pomodoro/useNotifications";

// How long the basil-green "Notifications on" success confirmation stays up
// before it auto-dismisses and the banner disappears for good (mock: ~3s).
const GRANTED_AUTO_DISMISS_MS = 3000;

type NudgeProps = Pick<
	UseNotificationsReturn,
	"supported" | "permission" | "request" | "dismissed" | "dismiss"
>;

// Dismissible inline nudge that encourages granting browser notification
// permission, placed between the brand header and the timer. A recessed clay
// trough (secondary to the clock), keyed by the current Notification.permission:
//   default → friendly nudge + "Enable"
//   denied  → blocked notice + how-to-re-enable (no Enable button)
//   granted → brief success confirmation, then auto-dismisses
// The actual end-of-interval notifications are fired by useTimer, not here.
export function NotificationNudge({
	supported,
	permission,
	request,
	dismissed,
	dismiss,
}: NudgeProps) {
	// The granted success banner shows briefly then hides for good. We track the
	// *hidden* state (flipped only inside the timeout callback) rather than the
	// shown state, so the effect never sets state synchronously on render.
	const [grantedHidden, setGrantedHidden] = useState(false);

	useEffect(() => {
		if (permission !== "granted") return;
		const handle = window.setTimeout(
			() => setGrantedHidden(true),
			GRANTED_AUTO_DISMISS_MS
		);
		return () => window.clearTimeout(handle);
	}, [permission]);

	// Hidden entirely when: API unsupported, user dismissed, or already granted
	// past the brief success confirmation.
	if (!supported || dismissed) return null;
	if (permission === "granted" && grantedHidden) return null;

	const isDenied = permission === "denied";
	const isGranted = permission === "granted";

	return (
		<Flex
			role={isGranted ? "status" : "region"}
			aria-live={isGranted ? "polite" : undefined}
			aria-label={
				isGranted
					? "Notifications enabled"
					: isDenied
						? "Notifications are blocked"
						: "Enable notifications"
			}
			position="relative"
			bg={isGranted ? "clay.basil100" : "clay.press"}
			borderRadius="clayMd"
			boxShadow="clayPressed"
			px="24px"
			py="16px"
			gap="16px"
			align={{ base: "flex-start", sm: "center" }}
			direction={{ base: "column", sm: "row" }}
		>
			{/* round clay icon disc — tomato in default, muted ink in denied,
			    basil-green in granted */}
			<Flex
				flexShrink={0}
				boxSize="48px"
				borderRadius="full"
				bg="clay.surfaceHi"
				boxShadow="claySoft"
				align="center"
				justify="center"
				color={
					isGranted ? "clay.basil600" : isDenied ? "clay.ink600" : "clay.tomato600"
				}
				aria-hidden="true"
			>
				{isGranted ? (
					<LuBellRing size={24} />
				) : isDenied ? (
					<LuBellOff size={24} />
				) : (
					<LuBell size={24} />
				)}
			</Flex>

			<Box flex="1" minW="0">
				<Text
					fontFamily="heading"
					fontWeight="800"
					fontSize="1rem"
					letterSpacing="-0.01em"
					color={isGranted ? "clay.basil600" : "clay.ink900"}
				>
					{isGranted
						? "Notifications on"
						: isDenied
							? "Notifications are blocked"
							: "Turn on notifications"}
				</Text>
				<Text fontSize="0.88rem" color="clay.ink600" mt="2px">
					{isGranted ? (
						"We'll ring you the moment a focus or break interval ends. 🍅"
					) : isDenied ? (
						<>
							To get timer alerts, allow notifications for this site in your
							browser's{" "}
							<Text
								as="span"
								display="inline-flex"
								alignItems="center"
								gap="4px"
								fontWeight="700"
								color="clay.ink900"
								bg="clay.surfaceHi"
								boxShadow="claySoft"
								borderRadius="claySm"
								px="8px"
								py="1px"
								whiteSpace="nowrap"
							>
								<LuSettings size={13} /> site settings
							</Text>
							.
						</>
					) : (
						"Know the moment your timer ends — even when this tab is in the background."
					)}
				</Text>
			</Box>

			{/* Enable CTA — only in the default state. requestPermission() is a no-op
			    once denied, so we never offer a button that can't work. */}
			{!isDenied && !isGranted && (
				<chakra.button
					type="button"
					onClick={request}
					aria-label="Enable browser notifications"
					flexShrink={0}
					w={{ base: "100%", sm: "auto" }}
					h="44px"
					fontFamily="heading"
					fontWeight="800"
					fontSize="0.92rem"
					color="white"
					px="24px"
					borderRadius="clayPill"
					bgGradient="to-br"
					gradientFrom="clay.tomato500"
					gradientTo="clay.tomato600"
					boxShadow="tomatoRaised"
					cursor="pointer"
					display="inline-flex"
					alignItems="center"
					justifyContent="center"
					gap="8px"
					transition="transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms ease"
					_hover={{ transform: "translateY(-2px)" }}
					_active={{ transform: "scale(0.96)" }}
					_focusVisible={{ outline: "4px solid", outlineColor: "clay.tomato700", outlineOffset: "3px" }}
				>
					<LuBell size={18} /> Enable
				</chakra.button>
			)}

			{/* dismiss × — round clay icon button; persists dismissed so we don't nag */}
			<IconButton
				type="button"
				aria-label="Dismiss notifications nudge"
				onClick={dismiss}
				unstyled
				flexShrink={0}
				position={{ base: "absolute", sm: "static" }}
				top={{ base: "12px", sm: "auto" }}
				right={{ base: "12px", sm: "auto" }}
				w="36px"
				h="36px"
				borderRadius="full"
				bg="clay.surfaceHi"
				boxShadow="claySoft"
				color="clay.ink400"
				display="grid"
				placeItems="center"
				cursor="pointer"
				transition="transform 160ms ease, color 140ms ease, box-shadow 160ms ease"
				_hover={{ color: "clay.ink900", transform: "translateY(-1px)" }}
				_active={{ boxShadow: "clayPressed", transform: "scale(0.92)" }}
				_focusVisible={{ outline: "3px solid", outlineColor: "clay.tomato500", outlineOffset: "2px" }}
			>
				<LuX size={16} />
			</IconButton>
		</Flex>
	);
}
