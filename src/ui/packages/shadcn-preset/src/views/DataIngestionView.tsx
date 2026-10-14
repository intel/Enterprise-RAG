// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { CloudArrowUpIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FileStatus = "ingested" | "processing" | "error";

const STATUS_COLOR: Record<FileStatus, "success" | "error" | "muted"> = {
  ingested: "success",
  processing: "muted",
  error: "error",
};

const FILES: {
  name: string;
  source: string;
  status: FileStatus;
  size: string;
  chunksProcessed: number;
  chunksTotal: number;
  processingTime: string;
}[] = [
  {
    name: "architecture.md",
    source: "S3 · rag-docs",
    status: "ingested",
    size: "128 KB",
    chunksProcessed: 42,
    chunksTotal: 42,
    processingTime: "12.4s",
  },
  {
    name: "onboarding-guide.pdf",
    source: "SharePoint · IT Site",
    status: "processing",
    size: "2.1 MB",
    chunksProcessed: 18,
    chunksTotal: 60,
    processingTime: "—",
  },
  {
    name: "guardrails-policy.docx",
    source: "S3 · rag-docs",
    status: "error",
    size: "84 KB",
    chunksProcessed: 0,
    chunksTotal: 12,
    processingTime: "—",
  },
];

function DataIngestionView() {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-16">
      <Tabs defaultValue="files" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <CloudArrowUpIcon />
                  Upload data
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload data</DialogTitle>
                <DialogDescription>
                  Drag and drop files here, or browse to select files to ingest.
                </DialogDescription>
              </DialogHeader>
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] p-8">
                <CloudArrowUpIcon className="size-6" />
                <p>Drop files to upload</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setOpen(false)}>Upload</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="files">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Processing Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FILES.map((file) => (
                <TableRow key={file.name}>
                  <TableCell>
                    <StatusDot
                      color={STATUS_COLOR[file.status]}
                      label={file.status}
                      showLabel
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.source}
                  </TableCell>
                  <TableCell>{file.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.size}
                  </TableCell>
                  <TableCell>
                    <div className="flex w-24 flex-col gap-1">
                      <span className="text-muted-foreground text-right text-xs">
                        {file.chunksProcessed}/{file.chunksTotal}
                      </span>
                      <Progress
                        value={(file.chunksProcessed / file.chunksTotal) * 100}
                        aria-label={`${file.chunksProcessed} of ${file.chunksTotal} chunks processed`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button className="text-muted-foreground underline-offset-2 hover:underline">
                            {file.processingTime}
                          </button>
                        }
                      />
                      <PopoverContent>
                        <p className="font-medium">Processing breakdown</p>
                        <p className="text-muted-foreground">
                          Text extraction, splitting, embedding and ingestion
                          durations would appear here.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline">
                        Download
                      </Button>
                      {file.status === "error" && (
                        <Button size="sm" variant="outline">
                          Retry
                        </Button>
                      )}
                      <Button size="sm" variant="destructive">
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="links">
          <p className="text-muted-foreground">
            Links table would follow the same layout as Files.
          </p>
        </TabsContent>

        <TabsContent value="settings">
          <p className="text-muted-foreground">
            Data ingestion settings would go here.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DataIngestionView;
