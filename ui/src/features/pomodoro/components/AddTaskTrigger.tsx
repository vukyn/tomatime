"use client";

import { chakra } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";

interface AddTaskTriggerProps {
	onClick: () => void;
}

// Collapsed-state CTA that stands in for the create form. Clicking it expands
// the form (see PomodoroPage). Reuses the primary submit-CTA clay styling:
// full-width puffy tomato gradient with the raised tomato shadow.
export function AddTaskTrigger({ onClick }: AddTaskTriggerProps) {
	return (
		<chakra.button
			type="button"
			onClick={onClick}
			aria-expanded={false}
			aria-controls="create-form"
			w="100%"
			fontFamily="heading"
			fontWeight="800"
			fontSize="1rem"
			color="white"
			px="20px"
			py="16px"
			borderRadius="clayMd"
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
			_active={{ transform: "scale(0.98)", boxShadow: "clayPressed" }}
			_focusVisible={{ outline: "4px solid", outlineColor: "clay.tomato500", outlineOffset: "4px" }}
		>
			<LuPlus size={20} /> Add task
		</chakra.button>
	);
}
