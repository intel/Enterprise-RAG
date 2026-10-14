// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  CheckCircleIcon,
  InfoIcon,
  MoonIcon,
  SunIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/StatusDot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { PromptInput } from "@/components/ui/prompt-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ChatView from "@/views/ChatView";
import ControlPlaneView from "@/views/ControlPlaneView";
import DataIngestionView from "@/views/DataIngestionView";

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
] as const;

const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;

const SELECT_LABELS: Record<string, string> = {
  one: "Inside project",
  two: "Custom...",
  three: "Three",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    // --border resolves to the same value as --popover/--card/--secondary in this
    // palette, so a plain border-border divider is invisible against the page background.
    <section className="flex flex-col gap-3 border-b border-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] pb-8">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function ComponentsView() {
  const [progress, setProgress] = useState(40);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Section>

      <Section title="Button matrix">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-muted-foreground p-2 text-left text-xs font-medium">
                  Size
                </th>
                {BUTTON_VARIANTS.map((variant) => (
                  <th
                    key={variant}
                    className="text-muted-foreground p-2 text-left text-xs font-medium capitalize"
                  >
                    {variant}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUTTON_SIZES.map((size) => (
                <tr key={size}>
                  <td className="text-muted-foreground p-2 text-xs">{size}</td>
                  {BUTTON_VARIANTS.map((variant) => (
                    <td key={variant} className="p-2">
                      <Button variant={variant} size={size}>
                        {variant}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Dialog">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            Action / confirm
          </span>
          <Dialog>
            <DialogTrigger
              render={<Button variant="outline">Open dialog</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogDescription>
                  This is the base-mira dialog style — plain floating close
                  button, no colored header bar.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose
                  render={
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                  }
                />
                <Button variant="destructive" size="sm">
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            Regular, larger, centered on overlay
          </span>
          <Dialog>
            <DialogTrigger
              render={<Button variant="outline">Open large dialog</Button>}
            />
            <DialogContent size="lg" className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg">
                  Workspace settings
                </DialogTitle>
                <DialogDescription>
                  A regular dialog for longer forms — same centered-on-overlay
                  placement as the confirm dialog, just a wider max width.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input id="workspace-name" defaultValue="Enterprise RAG" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="workspace-region">Region</Label>
                  <Input id="workspace-region" defaultValue="us-east-1" />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="workspace-description">Description</Label>
                  <Textarea
                    id="workspace-description"
                    defaultValue="Retrieval-augmented generation pipeline for internal docs."
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline">Cancel</Button>}
                />
                <Button>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      <Section title="Dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline">Open menu</Button>}
          />
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Tooltip">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost">Hover me</Button>} />
          <TooltipContent>This is a tooltip</TooltipContent>
        </Tooltip>
      </Section>

      <Section title="Popover">
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline">Open popover</Button>}
          />
          <PopoverContent>Popover content goes here.</PopoverContent>
        </Popover>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="tab1" className="w-full">
          <TabsList>
            <TabsTrigger value="tab1">Tab one</TabsTrigger>
            <TabsTrigger value="tab2">Tab two</TabsTrigger>
            <TabsTrigger value="tab3">Tab three</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content for tab one.</TabsContent>
          <TabsContent value="tab2">Content for tab two.</TabsContent>
          <TabsContent value="tab3">Content for tab three.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Switch">
        <div className="flex items-center gap-2">
          <Switch id="switch-demo-sm" size="sm" />
          <Label htmlFor="switch-demo-sm">Small</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="switch-demo" />
          <Label htmlFor="switch-demo">Default — Enable notifications</Label>
        </div>
      </Section>

      <Section title="Checkbox">
        <div className="flex items-center gap-2">
          <Checkbox id="checkbox-demo-sm" size="sm" />
          <Label htmlFor="checkbox-demo-sm">Small</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="checkbox-demo" />
          <Label htmlFor="checkbox-demo">Default — Accept terms</Label>
        </div>
      </Section>

      <Section title="Input">
        <Input placeholder="Small" size="sm" className="max-w-xs" />
        <Input placeholder="Default — Type something..." className="max-w-xs" />
      </Section>

      <Section title="Textarea">
        <Textarea placeholder="Small" size="sm" className="max-w-xs" />
        <Textarea
          placeholder="Default — Type a longer message..."
          className="max-w-xs"
        />
      </Section>

      <Section title="Select">
        <Select defaultValue="one">
          <SelectTrigger
            size="sm"
            className="w-full max-w-xs"
            aria-label="Choose one (small)"
          >
            <SelectValue placeholder="Choose one">
              {(value: string) => SELECT_LABELS[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">
              <span className="flex flex-col">
                <span>Inside project</span>
                <span className="text-muted-foreground text-xs">
                  .claude/worktrees
                </span>
              </span>
            </SelectItem>
            <SelectItem value="two">Custom...</SelectItem>
            <SelectItem value="three">Three</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="one">
          <SelectTrigger className="w-full max-w-xs" aria-label="Choose one">
            <SelectValue placeholder="Choose one">
              {(value: string) => SELECT_LABELS[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">
              <span className="flex flex-col">
                <span>Inside project</span>
                <span className="text-muted-foreground text-xs">
                  .claude/worktrees
                </span>
              </span>
            </SelectItem>
            <SelectItem value="two">Custom...</SelectItem>
            <SelectItem value="three">Three</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <Section title="Label">
        <Label>Standalone label</Label>
      </Section>

      <Section title="Progress">
        <div className="flex w-full max-w-xs items-center gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-muted-foreground text-right text-xs">
              {progress}%
            </span>
            <Progress value={progress} aria-label="Demo progress" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProgress((p) => (p >= 100 ? 0 : p + 20))}
          >
            +20
          </Button>
        </div>
      </Section>

      <Section title="Sonner (toast)">
        <Button
          variant="outline"
          onClick={() => toast.success("Saved successfully")}
        >
          Trigger success toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error("Something went wrong")}
        >
          Trigger error toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.warning("Embedding model changed")}
        >
          Trigger warning toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info("Sync scheduled for tonight")}
        >
          Trigger info toast
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
              loading: "Uploading file...",
              success: "File uploaded",
              error: "Upload failed",
            })
          }
        >
          Trigger loading toast
        </Button>
      </Section>

      <Section title="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Ingestion job</CardTitle>
            <CardDescription>docs/architecture.md</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Chunked into 42 passages, embedded with bge-large-en.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">View</Button>
            <Button size="sm" variant="outline">
              Re-run
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Alert">
        <Alert className="max-w-sm">
          <CheckCircleIcon weight="fill" />
          <AlertTitle>Sync scheduled</AlertTitle>
          <AlertDescription>
            The data source will re-sync tonight at 2:00 AM.
          </AlertDescription>
        </Alert>
        <Alert variant="error" className="max-w-sm">
          <XCircleIcon weight="fill" />
          <AlertTitle>Sync failed</AlertTitle>
          <AlertDescription>
            SharePoint connector lost authorization — reconnect to resume.
          </AlertDescription>
        </Alert>
        <Alert variant="info" className="max-w-sm">
          <InfoIcon weight="fill" />
          <AlertTitle>New pipeline available</AlertTitle>
          <AlertDescription>
            The translation flavour was added to this deployment.
          </AlertDescription>
        </Alert>
      </Section>

      <Section title="Separator">
        <div className="flex w-full max-w-xs flex-col gap-3">
          <span>Above</span>
          <Separator />
          <span>Below</span>
        </div>
      </Section>

      <Section title="Data table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chunks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { doc: "architecture.md", status: "Indexed", chunks: 42 },
              { doc: "auth.md", status: "Indexed", chunks: 18 },
              { doc: "pipelines.md", status: "Pending", chunks: 0 },
            ].map((row) => (
              <TableRow key={row.doc}>
                <TableCell>{row.doc}</TableCell>
                <TableCell>
                  <StatusDot
                    color={row.status === "Indexed" ? "success" : "muted"}
                    label={row.status}
                    showLabel
                  />
                </TableCell>
                <TableCell>{row.chunks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="File input">
        <FileInput
          className="w-full max-w-sm"
          supportedFileExtensions={["pdf", "docx", "md"]}
          totalSizeLimit={50}
        />
      </Section>

      <Section title="Prompt input">
        <PromptInputDemo />
      </Section>

      <Section title="Prompt input (with microphone)">
        <PromptInputWithMicDemo />
      </Section>
    </div>
  );
}

function PromptInputDemo() {
  const [value, setValue] = useState("");

  return (
    <PromptInput
      className="w-full"
      value={value}
      onValueChange={setValue}
      onSubmit={(prompt) => {
        toast.success(`Sent: ${prompt}`);
        setValue("");
      }}
    />
  );
}

function PromptInputWithMicDemo() {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  return (
    <PromptInput
      className="w-full"
      value={value}
      onValueChange={setValue}
      onSubmit={(prompt) => {
        toast.success(`Sent: ${prompt}`);
        setValue("");
      }}
      isRecording={isRecording}
      onMicClick={() => {
        setIsRecording((recording) => !recording);
        toast.info(isRecording ? "Recording stopped" : "Recording started");
      }}
    />
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
        }
      />
      <TooltipContent>
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}

// Preview-only: all OS-native system fonts (never a bundled webfont — the product's
// licensing constraint stays intact), just to compare stacks live. Doesn't touch
// index.css's real --font-sans default.
const FONT_OPTIONS = [
  {
    value: "system",
    label: "System default (current)",
    stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Helvetica Neue", Arial, sans-serif`,
  },
  { value: "arial", label: "Arial", stack: `Arial, Helvetica, sans-serif` },
  {
    value: "segoe",
    label: "Segoe UI",
    stack: `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
  },
  { value: "verdana", label: "Verdana", stack: `Verdana, Geneva, sans-serif` },
  { value: "tahoma", label: "Tahoma", stack: `Tahoma, Geneva, sans-serif` },
  {
    value: "trebuchet",
    label: "Trebuchet MS",
    stack: `"Trebuchet MS", sans-serif`,
  },
] as const;

function FontSwitcher() {
  const [font, setFont] = useState("system");

  return (
    <Select
      value={font}
      onValueChange={(value: string) => {
        setFont(value);
        const stack = FONT_OPTIONS.find((o) => o.value === value)?.stack ?? "";
        // @theme inline compiles font-sans to a literal value at build time (no runtime
        // var(--font-sans) to override), so an inline style on body is what actually wins.
        document.body.style.fontFamily = stack;
      }}
    >
      <SelectTrigger size="sm" className="w-48" aria-label="Preview font stack">
        <SelectValue>
          {(value: string) =>
            FONT_OPTIONS.find((o) => o.value === value)?.label ?? value
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FONT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const VIEWS = [
  { value: "components", label: "Components", Component: ComponentsView },
  { value: "chat", label: "Chat", Component: ChatView },
  {
    value: "control-plane",
    label: "Control Plane",
    Component: ControlPlaneView,
  },
  {
    value: "data-ingestion",
    label: "Data Ingestion",
    Component: DataIngestionView,
  },
] as const;

function App() {
  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            shadcn preset harness — base-mira
          </h1>
          <div className="flex items-center gap-2">
            <FontSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <Tabs defaultValue="components">
          <TabsList>
            {VIEWS.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {VIEWS.map(({ value, Component }) => (
            <TabsContent key={value} value={value}>
              <Component />
            </TabsContent>
          ))}
        </Tabs>
      </main>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
