import { Box, Flex, Heading, Text } from "@chakra-ui/react";

// Brand header — clay tomato mark + "tomatime" wordmark (tomato-accented suffix).
export function BrandHeader() {
	return (
		<Flex as="header" align="center" justify="center" gap="12px">
			<Box
				w="44px"
				h="44px"
				borderRadius="claySm"
				bgGradient="to-br"
				gradientFrom="clay.tomato500"
				gradientTo="clay.tomato600"
				boxShadow="tomatoRaised"
				display="grid"
				placeItems="center"
				color="white"
				aria-hidden="true"
			>
				<svg
					viewBox="0 0 24 24"
					width="26"
					height="26"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M12 8a6 6 0 1 0 6 6 6 6 0 0 0-6-6Z" />
					<path d="M12 8c-1-2-3-3-5-2 1 2 3 3 5 2Zm0 0c1-2 3-3 5-2-1 2-3 3-5 2Z" />
				</svg>
			</Box>
			<Heading
				as="h1"
				fontFamily="heading"
				fontWeight="900"
				fontSize="1.5rem"
				letterSpacing="-0.02em"
				color="clay.ink900"
			>
				toma
				<Text as="span" color="clay.tomato600">
					time
				</Text>
			</Heading>
		</Flex>
	);
}
