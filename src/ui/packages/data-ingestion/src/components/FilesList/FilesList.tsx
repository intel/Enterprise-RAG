// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton } from "@intel-enterprise-rag-ui/components";
import { formatFileSize } from "@intel-enterprise-rag-ui/utils";
import { Dispatch, SetStateAction } from "react";

import ListHeader from "@/components/ListHeader/ListHeader";

interface FilesListProps {
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
}

const FilesList = ({ files, setFiles }: FilesListProps) => {
  const clearList = () => {
    setFiles([]);
  };

  const removeDocumentFromList = (fileIndex: number) => {
    setFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== fileIndex),
    );
  };

  return (
    <>
      <ListHeader onClearListBtnPress={clearList} />
      <ul>
        {files.map((file, index) => (
          <li
            key={`file-list-item-${index}`}
            className="mb-3 grid h-10 grid-cols-[1fr_2.5rem] items-center gap-2"
          >
            <div className="border-border bg-secondary grid h-10 grid-cols-[10fr_2fr] items-center gap-4 rounded border px-3.5 py-2">
              <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                {file.name}
              </p>
              <p className="text-right text-xs">{formatFileSize(file.size)}</p>
            </div>
            <IconButton
              data-testid="delete-file-from-list-button"
              icon="delete"
              variant="destructive"
              aria-label="Delete file from the list"
              onPress={() => removeDocumentFromList(index)}
            />
          </li>
        ))}
      </ul>
    </>
  );
};

export default FilesList;
