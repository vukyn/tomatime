import { Dialog, Portal, Text, chakra } from "@chakra-ui/react";

interface ConfirmDeleteDialogProps {
	open: boolean;
	taskName?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

// Clay confirm dialog for the destructive delete action.
export function ConfirmDeleteDialog({ open, taskName, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
	return (
		<Dialog.Root
			open={open}
			onOpenChange={(e) => {
				if (!e.open) onCancel();
			}}
			placement="center"
			role="alertdialog"
		>
			<Portal>
				<Dialog.Backdrop bg="rgba(58, 46, 39, 0.35)" />
				<Dialog.Positioner>
					<Dialog.Content bg="clay.surfaceHi" borderRadius="clayMd" boxShadow="clayRaised" p="24px" maxW="360px">
						<Dialog.Header p="0" mb="8px">
							<Dialog.Title fontFamily="heading" fontWeight="900" fontSize="1.2rem" color="clay.ink900">
								Delete task?
							</Dialog.Title>
						</Dialog.Header>
						<Dialog.Body p="0" mb="24px">
							<Text color="clay.ink600">
								{taskName ? (
									<>
										“<Text as="span" fontWeight="700" color="clay.ink900">{taskName}</Text>” will be removed. You can undo right after.
									</>
								) : (
									"This task will be removed. You can undo right after."
								)}
							</Text>
						</Dialog.Body>
						<Dialog.Footer p="0" display="flex" justifyContent="flex-end" gap="12px">
							<chakra.button
								type="button"
								onClick={onCancel}
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
							<chakra.button
								type="button"
								onClick={onConfirm}
								fontFamily="heading"
								fontWeight="800"
								fontSize="0.95rem"
								color="white"
								px="24px"
								py="12px"
								borderRadius="clayPill"
								bgGradient="to-br"
								gradientFrom="clay.tomato500"
								gradientTo="clay.tomato600"
								boxShadow="tomatoRaised"
								cursor="pointer"
								transition="transform 160ms cubic-bezier(0.34,1.56,0.64,1)"
								_active={{ transform: "scale(0.96)" }}
							>
								Delete
							</chakra.button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Positioner>
			</Portal>
		</Dialog.Root>
	);
}
