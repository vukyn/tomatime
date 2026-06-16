import { Box, Text } from "@chakra-ui/react";
import { LuListChecks } from "react-icons/lu";

// Shown when the task list is empty.
export function EmptyState() {
	return (
		<Box
			bg="clay.surface"
			borderRadius="clayMd"
			boxShadow="claySoft"
			px="24px"
			py="48px"
			textAlign="center"
			color="clay.ink600"
			display="flex"
			flexDirection="column"
			alignItems="center"
			gap="12px"
		>
			<Box
				w="72px"
				h="72px"
				borderRadius="clayMd"
				bg="clay.press"
				boxShadow="clayPressed"
				display="grid"
				placeItems="center"
				color="clay.tomato500"
				aria-hidden="true"
			>
				<LuListChecks size={34} />
			</Box>
			<Text as="h3" fontFamily="heading" fontWeight="900" fontSize="1.1rem" color="clay.ink900">
				No tasks yet
			</Text>
			<Text>Add your first task above and start a pomodoro to get rolling.</Text>
		</Box>
	);
}
