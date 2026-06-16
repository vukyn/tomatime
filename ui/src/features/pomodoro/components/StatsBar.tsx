import { Box, Flex, Text } from "@chakra-ui/react";

interface StatsBarProps {
	completedPomodoros: number;
	totalPomodoros: number;
	estimatedFinish: string; // "5:40 PM" or "—"
	focusTime: string; // "1h 15m"
}

// Footer session-stats bar (recessed clay trough).
export function StatsBar({
	completedPomodoros,
	totalPomodoros,
	estimatedFinish,
	focusTime,
}: StatsBarProps) {
	return (
		<Flex
			aria-label="Session stats"
			bg="clay.press"
			borderRadius="clayMd"
			boxShadow="clayPressed"
			px="24px"
			py="16px"
			justify="space-around"
			gap="16px"
			wrap="wrap"
		>
			<Stat label="Pomodoros">
				<Text as="span" color="clay.tomato600">
					{completedPomodoros}
				</Text>
				/{totalPomodoros}
			</Stat>
			<Stat label="Est. finish">{estimatedFinish}</Stat>
			<Stat label="Focus time">{focusTime}</Stat>
		</Flex>
	);
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Box textAlign="center" minW="100px">
			<Text
				fontFamily="heading"
				fontWeight="900"
				fontSize="1.3rem"
				color="clay.ink900"
				css={{ fontVariantNumeric: "tabular-nums" }}
			>
				{children}
			</Text>
			<Text
				fontSize="0.78rem"
				fontWeight="700"
				letterSpacing="0.04em"
				textTransform="uppercase"
				color="clay.ink600"
				mt="2px"
			>
				{label}
			</Text>
		</Box>
	);
}
