// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Popover,
  usePopover,
} from "@intel-enterprise-rag-ui/components";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { memo, useEffect, useRef, useState } from "react";

import { END_DATA_STATUSES } from "@/config/api";
import useProcessingTimeFormat from "@/hooks/useProcessingTimeFormat";
import { DataStatus } from "@/types";

type DurationKey =
  | "text_extractor_duration"
  | "text_compression_duration"
  | "text_splitter_duration"
  | "dpguard_duration"
  | "late_chunking_duration"
  | "embedding_duration"
  | "ingestion_duration";

const durationLegendItems: {
  key: DurationKey;
  className: string;
  label: string;
}[] = [
  {
    key: "text_extractor_duration",
    className: "bg-red-600 dark:bg-red-400",
    label: "Text Extractor",
  },
  {
    key: "text_compression_duration",
    className: "bg-amber-600 dark:bg-amber-400",
    label: "Text Compression",
  },
  {
    key: "text_splitter_duration",
    className: "bg-green-600 dark:bg-green-400",
    label: "Text Splitter",
  },
  {
    key: "dpguard_duration",
    className: "bg-fuchsia-600 dark:bg-fuchsia-400",
    label: "Data Prep Guardrails",
  },
  {
    key: "late_chunking_duration",
    className: "bg-sky-600 dark:bg-sky-400",
    label: "Late Chunking",
  },
  {
    key: "embedding_duration",
    className: "bg-sky-600 dark:bg-sky-400",
    label: "Embedding",
  },
  {
    key: "ingestion_duration",
    className: "bg-purple-600 dark:bg-purple-400",
    label: "Ingestion",
  },
];

interface ProcessingTimePopoverProps {
  textExtractorDuration: number;
  textCompressionDuration: number;
  textSplitterDuration: number;
  dpguardDuration: number;
  lateChunkingDuration: number;
  embeddingDuration: number;
  ingestionDuration: number;
  processingDuration: number;
  jobStartTime: number;
  dataStatus: DataStatus;
}

const ProcessingTimePopover = memo(
  ({
    textExtractorDuration = 0,
    textCompressionDuration = 0,
    textSplitterDuration = 0,
    dpguardDuration = 0,
    lateChunkingDuration = 0,
    embeddingDuration = 0,
    ingestionDuration = 0,
    processingDuration = 0,
    jobStartTime = 0,
    dataStatus,
  }: ProcessingTimePopoverProps) => {
    const { formatProcessingTime } = useProcessingTimeFormat();
    const [timer, setTimer] = useState("N/A");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { triggerRef, isOpen, togglePopover } =
      usePopover<HTMLButtonElement>();

    useEffect(() => {
      const observationStart = Date.now();
      const initialElapsed =
        jobStartTime !== 0
          ? Math.max(0, observationStart - jobStartTime * 1000)
          : 0;

      const updateTimer = () => {
        if (jobStartTime !== 0) {
          const elapsedTime =
            initialElapsed + Math.floor(Date.now() - observationStart);
          setTimer(formatProcessingTime(elapsedTime));
        } else {
          setTimer(formatProcessingTime(0));
        }
      };

      if (!END_DATA_STATUSES.includes(dataStatus)) {
        updateTimer();
        intervalRef.current = setInterval(updateTimer, 1000);
      } else if (processingDuration !== 0) {
        setTimer(formatProcessingTime(processingDuration));
      } else {
        setTimer("N/A");
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [dataStatus, formatProcessingTime, jobStartTime, processingDuration]);

    if (processingDuration <= 0) {
      return <span>{timer}</span>;
    }

    const formattedTotalProcessingTime =
      formatProcessingTime(processingDuration);

    const durations: Record<DurationKey, number> = {
      text_extractor_duration: textExtractorDuration,
      text_compression_duration: textCompressionDuration,
      text_splitter_duration: textSplitterDuration,
      dpguard_duration: dpguardDuration,
      late_chunking_duration: lateChunkingDuration,
      embedding_duration: embeddingDuration,
      ingestion_duration: ingestionDuration,
    };

    return (
      <>
        <Button
          ref={triggerRef}
          data-testid="processing-time-popover-trigger"
          variant="ghost"
          className="text-foreground h-auto cursor-pointer bg-transparent p-0 text-xs underline hover:bg-transparent dark:bg-transparent"
          onPress={togglePopover}
        >
          {timer}
        </Button>
        <Popover
          triggerRef={triggerRef}
          isOpen={isOpen}
          placement="bottom"
          ariaLabel="Processing Time Details"
          onOpenChange={togglePopover}
        >
          <div className="w-80">
            <header className="grid grid-cols-2 font-medium">
              <p>Total Processing Time</p>
              <p className="text-right">{formattedTotalProcessingTime}</p>
            </header>
            <div className="bg-card my-3 flex h-4 w-full overflow-hidden rounded">
              {durationLegendItems.map(({ key, className, label }) => {
                const percent =
                  processingDuration > 0
                    ? (durations[key] / processingDuration) * 100
                    : 0;

                if (percent === 0) return null;

                return (
                  <span
                    key={key}
                    className={className}
                    style={{ width: `${percent}%`, height: "100%" }}
                    title={label}
                    aria-label={label}
                  />
                );
              })}
            </div>
            {durationLegendItems.map(({ key, className, label }) => {
              const duration = durations[key];

              if (duration === 0) return null;

              return (
                <div
                  key={key}
                  className="mx-1 grid grid-cols-[0.75rem_1fr_5rem] items-center gap-x-1.5 text-xs not-last-of-type:mb-1"
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full bg-gray-600 dark:bg-gray-400",
                      className,
                    )}
                  ></span>
                  <p>{label}</p>
                  <p className="text-right">{formatProcessingTime(duration)}</p>
                </div>
              );
            })}
          </div>
        </Popover>
      </>
    );
  },
);

ProcessingTimePopover.displayName = "ProcessingTimePopover";

export default ProcessingTimePopover;
