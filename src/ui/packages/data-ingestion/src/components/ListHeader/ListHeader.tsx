// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@intel-enterprise-rag-ui/components";
import { cn } from "@intel-enterprise-rag-ui/utils";

interface ListHeaderProps {
  title?: string;
  onClearListBtnPress: () => void;
}

const ListHeader = ({ title, onClearListBtnPress }: ListHeaderProps) => (
  <header
    className={cn(
      "my-4 flex w-full items-center justify-end",
      title && "justify-between",
    )}
  >
    {title && <h3>{title}</h3>}
    <Button
      data-testid="delete-all-button"
      variant="destructive"
      size="sm"
      onPress={onClearListBtnPress}
    >
      Delete All
    </Button>
  </header>
);

export default ListHeader;
