// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0
// Dev-only harness: mounts every primitive with mock props, no auth/API/app shell.

import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "../src/Alert/Alert";
import { AlertDialog } from "../src/AlertDialog/AlertDialog";
import { Anchor } from "../src/Anchor/Anchor";
import { AnchorCard } from "../src/AnchorCard/AnchorCard";
import { Button, ButtonVariant } from "../src/Button/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../src/Card/Card";
import { Checkbox } from "../src/Checkbox/Checkbox";
import { ColorSchemeSwitch } from "../src/ColorSchemeSwitch/ColorSchemeSwitch";
import { Combobox } from "../src/Combobox/Combobox";
import { Dialog, DialogRef } from "../src/Dialog/Dialog";
import { DropdownButton } from "../src/DropdownButton/DropdownButton";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/DropdownMenu/DropdownMenu";
import { IconButton, IconButtonVariant } from "../src/IconButton/IconButton";
import { Input } from "../src/Input/Input";
import { Label } from "../src/Label/Label";
import { Popover } from "../src/Popover/Popover";
import { Progress } from "../src/Progress/Progress";
import { Select } from "../src/Select/Select";
import { Separator } from "../src/Separator/Separator";
import { Switch } from "../src/Switch/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/Table/Table";
import { Tabs } from "../src/Tabs/Tabs";
import { Textarea } from "../src/Textarea/Textarea";
import { Tooltip } from "../src/Tooltip/Tooltip";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="border-border mb-8 rounded border p-4">
    <h2 className="mb-4 text-lg font-medium">{title}</h2>
    <div className="flex flex-wrap items-center gap-4">{children}</div>
  </section>
);

const PopoverDemo = () => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button ref={triggerRef} onPress={() => setIsOpen((v) => !v)}>
        Toggle Popover
      </Button>
      <Popover
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        ariaLabel="Demo popover"
      >
        <div>Popover content</div>
      </Popover>
    </>
  );
};

const DialogDemo = () => {
  const dialogRef = useRef<DialogRef>(null);

  return (
    <Dialog
      ref={dialogRef}
      title="Demo Dialog"
      trigger={
        <Button data-testid="open-dialog-demo-button">Open Dialog</Button>
      }
      onClose={() => dialogRef.current?.close()}
    >
      <div className="p-4">Dialog content</div>
    </Dialog>
  );
};

// Regression guard: mirrors AboutDialog's exact composition (Dialog's `trigger` wraps a Tooltip,
// which wraps an IconButton). This is what silently broke when IconButton was still react-aria's
// `usePress` (it stops pointer-event propagation before it reaches Base UI's Dialog trigger listener)
// — see plan.md's 2026-09-15 note. Keep this demo even after IconButton is migrated, so a future
// regression here is caught immediately instead of only surfacing in the live app.
const NestedTriggerDemo = () => {
  const dialogRef = useRef<DialogRef>(null);

  return (
    <Dialog
      ref={dialogRef}
      title="Nested Trigger Dialog"
      trigger={
        <Tooltip
          title="Open nested dialog"
          trigger={<IconButton icon="info" aria-label="Open nested dialog" />}
        />
      }
      onClose={() => dialogRef.current?.close()}
    >
      <div className="p-4">
        Opened via Dialog &gt; Tooltip &gt; IconButton — same composition as
        AboutDialog.
      </div>
    </Dialog>
  );
};

const DropdownMenuDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenuTrigger
      trigger={
        <IconButton
          icon="more-options"
          aria-label="Open menu"
          onPress={() => setIsOpen((v) => !v)}
        />
      }
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel="Demo menu"
    >
      <DropdownMenu onAction={() => setIsOpen(false)}>
        <DropdownMenuItem id="one">One</DropdownMenuItem>
        <DropdownMenuItem id="two">Two</DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
};

const TabsDemo = () => {
  const [selectedTab, setSelectedTab] = useState("tab1");

  return (
    <Tabs
      tabs={[
        { id: "tab1", name: "Tab 1", panel: <div>Tab 1 content</div> },
        { id: "tab2", name: "Tab 2", panel: <div>Tab 2 content</div> },
      ]}
      selectedTab={selectedTab}
      onSelectionChange={setSelectedTab}
    />
  );
};

const BUTTON_VARIANTS: ButtonVariant[] = [
  "default",
  "destructive",
  "success",
  "outline",
  "ghost",
];

const ICON_BUTTON_VARIANTS: IconButtonVariant[] = [
  "default",
  "destructive",
  "success",
  "outline",
  "ghost",
];

const ButtonMatrix = () => (
  <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-4">
    <div />
    <div className="text-muted-foreground text-xs font-medium">
      Default size
    </div>
    <div className="text-muted-foreground text-xs font-medium">Small</div>
    {BUTTON_VARIANTS.map((variant) => (
      <Fragment key={variant}>
        <div className="text-sm font-medium capitalize">{variant}</div>
        <Button variant={variant}>{variant}</Button>
        <Button variant={variant} size="sm">
          {variant}
        </Button>
      </Fragment>
    ))}
  </div>
);

const IconButtonMatrix = () => (
  <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-4">
    <div />
    <div className="text-muted-foreground text-xs font-medium">
      Default size
    </div>
    <div className="text-muted-foreground text-xs font-medium">Small</div>
    {ICON_BUTTON_VARIANTS.map((variant) => (
      <Fragment key={variant}>
        <div className="text-sm font-medium capitalize">{variant}</div>
        <IconButton icon="close" aria-label={variant} variant={variant} />
        <IconButton
          icon="close"
          aria-label={variant}
          variant={variant}
          size="sm"
        />
      </Fragment>
    ))}
  </div>
);

const SelectDemo = () => {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Select
      label="Select"
      placeholder="Choose one"
      items={["Option A", "Option B"]}
      value={value}
      onChange={setValue}
    />
  );
};

const ComboboxDemo = () => {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Combobox
      placeholder="Choose a status"
      items={[
        "All",
        "Uploaded",
        "Error",
        "Processing",
        "Text Extracting",
        "Text Compression",
        "Text Splitting",
        "Dpguard",
        "Late Chunking",
        "Embedding",
        "Ingested",
        "Deleting",
        "Canceled",
        "Blocked",
      ]}
      value={value}
      onChange={setValue}
      data-testid="combobox-demo"
    />
  );
};

export const Harness = () => (
  <div className="bg-background text-foreground min-h-screen p-6">
    <h1 className="mb-6 text-2xl font-semibold">packages/components harness</h1>
    <div className="mb-6">
      <ColorSchemeSwitch />
    </div>

    <Section title="Button — variant x size matrix">
      <ButtonMatrix />
    </Section>

    <Section title="Button — extras">
      <Button icon="close">With icon</Button>
      <Button isDisabled>Disabled</Button>
      <Button size="sm" icon="close">
        Small with icon
      </Button>
    </Section>

    <Section title="IconButton — variant x size matrix">
      <IconButtonMatrix />
    </Section>

    <Section title="Tooltip">
      <Tooltip title="Tooltip text" trigger={<Button>Hover me</Button>} />
    </Section>

    <Section title="Dialog">
      <DialogDemo />
    </Section>

    <Section title="Nested trigger (Dialog > Tooltip > IconButton)">
      <NestedTriggerDemo />
    </Section>

    <Section title="Popover">
      <PopoverDemo />
    </Section>

    <Section title="DropdownMenu">
      <DropdownMenuDemo />
    </Section>

    <Section title="DropdownButton">
      <DropdownButton
        label="Dropdown"
        selectedValue="a"
        options={[
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ]}
        onPress={() => {}}
        onSelectionChange={() => {}}
      />
    </Section>

    <Section title="AlertDialog">
      <AlertDialog
        title="Confirm"
        trigger={<Button variant="outline">Open AlertDialog</Button>}
        onConfirm={() => {}}
      >
        <p>Default confirm variant</p>
      </AlertDialog>
      <AlertDialog
        title="Confirm delete"
        confirmLabel="Delete"
        confirmVariant="destructive"
        trigger={
          <Button variant="outline">Open destructive AlertDialog</Button>
        }
        onConfirm={() => {}}
      >
        <p>Destructive confirm variant</p>
      </AlertDialog>
    </Section>

    <Section title="Switch">
      <Switch />
    </Section>

    <Section title="Checkbox">
      <Checkbox label="Check me" onChange={() => {}} />
    </Section>

    <Section title="Input">
      <Input
        name="demo-text"
        value=""
        label="Text input"
        placeholder="Type here"
      />
    </Section>

    <Section title="Textarea">
      <Textarea
        name="demo-textarea"
        value=""
        label="Text area"
        placeholder="Type here"
      />
    </Section>

    <Section title="Select">
      <SelectDemo />
    </Section>

    <Section title="Combobox">
      <ComboboxDemo />
    </Section>

    <Section title="Progress">
      <Progress value={40} />
    </Section>

    <Section title="Label">
      <Label>A label</Label>
    </Section>

    <Section title="Anchor / AnchorCard">
      <Anchor href="#">Anchor link</Anchor>
      <AnchorCard href="#" text="Anchor card title" />
    </Section>

    <Section title="Tabs">
      <TabsDemo />
    </Section>

    <Section title="Alert">
      <div className="flex w-full flex-col gap-3">
        <Alert variant="success">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            The action completed successfully.
          </AlertDescription>
        </Alert>
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong.</AlertDescription>
        </Alert>
      </div>
    </Section>

    <Section title="Card">
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Card description text.</CardDescription>
        </CardHeader>
        <CardContent>Card content.</CardContent>
      </Card>
    </Section>

    <Section title="Separator">
      <div className="flex w-full flex-col gap-3">
        <div>Above</div>
        <Separator />
        <div>Below</div>
      </div>
    </Section>

    <Section title="Sonner">
      <Button
        variant="outline"
        onPress={() => toast.success("Action completed successfully.")}
      >
        Trigger success toast
      </Button>
      <Button
        variant="outline"
        onPress={() => toast.error("Something went wrong.")}
      >
        Trigger error toast
      </Button>
    </Section>

    <Section title="Table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>architecture.md</TableCell>
            <TableCell>Indexed</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Section>
  </div>
);
