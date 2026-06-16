# Chakra UI v3 Rules (all `ui/` frontends)

All UIs use Chakra UI v3. Never write v2 syntax. Key rules:

## Packages & imports

- No `@emotion/styled`, no `framer-motion`. Icons: `lucide-react` / `react-icons` (not `@chakra-ui/icons`). Hooks: `react-use` / `usehooks-ts` (not `@chakra-ui/hooks`).
- From `@chakra-ui/react`: Alert, Avatar, Button, Card, Field, Table, Input, NativeSelect, Tabs, Textarea, Separator, useDisclosure, Box, Flex, Stack, HStack, VStack, Text, Heading, Icon.
- From local `components/ui/` (relative imports): Provider, Toaster, ColorModeProvider, Tooltip, PasswordInput.

## Prop renames (v2 → v3)

| v2 | v3 |
|---|---|
| `isOpen` / `isDisabled` / `isInvalid` / `isRequired` / `isLoading` / `isChecked` / `isIndeterminate` | `open` / `disabled` / `invalid` / `required` / `loading` / `checked` / `indeterminate` |
| `isActive` | `data-active` |
| `colorScheme` | `colorPalette` |
| `spacing` | `gap` |
| `noOfLines` / `truncated` | `lineClamp` / `truncate` |
| `thickness` / `speed` | `borderWidth` / `animationDuration` |

## Component renames

Divider→Separator · Modal→Dialog · Collapse→Collapsible · Tags→Badge · `useToast()`→`toaster.create()`

## Compound component patterns (v3 form)

```tsx
// Toast
import { toaster } from "./components/ui/toaster"
toaster.create({ title: "Title", type: "error", meta: { closable: true }, placement: "top-end" })

// Dialog (was Modal)
<Dialog.Root open={isOpen} onOpenChange={onOpenChange} placement="center">
  <Dialog.Backdrop />
  <Dialog.Content>
    <Dialog.Header><Dialog.Title>Title</Dialog.Title></Dialog.Header>
    <Dialog.Body>Content</Dialog.Body>
  </Dialog.Content>
</Dialog.Root>

// Button icons: children, not leftIcon/rightIcon
<Button><Mail /> Email <ChevronRight /></Button>

// Alert
<Alert.Root borderStartWidth="4px" borderStartColor="colorPalette.solid">
  <Alert.Indicator />
  <Alert.Content>
    <Alert.Title>Title</Alert.Title>
    <Alert.Description>Description</Alert.Description>
  </Alert.Content>
</Alert.Root>

// Tooltip (local wrapper, content prop not label)
import { Tooltip } from "./components/ui/tooltip"
<Tooltip content="Content" showArrow positioning={{ placement: "top" }}>…</Tooltip>

// Field replaces FormControl/isInvalid
<Field.Root invalid>
  <Field.Label>Email</Field.Label>
  <Input />
  <Field.ErrorText>This field is required</Field.ErrorText>
</Field.Root>

// Table
<Table.Root variant="line">
  <Table.Header><Table.Row><Table.ColumnHeader>H</Table.ColumnHeader></Table.Row></Table.Header>
  <Table.Body><Table.Row><Table.Cell>C</Table.Cell></Table.Row></Table.Body>
</Table.Root>

// Tabs
<Tabs.Root defaultValue="one" colorPalette="orange">
  <Tabs.List><Tabs.Trigger value="one">One</Tabs.Trigger></Tabs.List>
  <Tabs.Content value="one">Content</Tabs.Content>
</Tabs.Root>

// Menu
<Menu.Root>
  <Menu.Trigger asChild><Button>Actions</Button></Menu.Trigger>
  <Menu.Content><Menu.Item value="download">Download</Menu.Item></Menu.Content>
</Menu.Root>

// Popover
<Popover.Root positioning={{ placement: "bottom-end" }}>
  <Popover.Trigger asChild><Button>Click</Button></Popover.Trigger>
  <Popover.Content><PopoverArrow /><Popover.Body>Content</Popover.Body></Popover.Content>
</Popover.Root>

// Select → NativeSelect
<NativeSelect.Root size="sm">
  <NativeSelect.Field placeholder="Select option"><option value="1">Option 1</option></NativeSelect.Field>
  <NativeSelect.Indicator />
</NativeSelect.Root>
```

## Style system

```tsx
// Nested selectors: css prop, & required
<Box css={{ "& svg": { color: "red.500" } }} />

// Gradients: split props
<Box bgGradient="to-r" gradientFrom="red.200" gradientTo="pink.500" />

// Theme token access
const system = useChakra()
const gray400 = system.token("colors.gray.400")
```
