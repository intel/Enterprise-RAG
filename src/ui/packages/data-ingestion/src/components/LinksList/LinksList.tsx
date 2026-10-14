// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./LinksList.css";

import { IconButton } from "@intel-enterprise-rag-ui/components";
import classNames from "classnames";
import { Dispatch, SetStateAction } from "react";

import ListHeader from "@/components/ListHeader/ListHeader";
import { LinkForIngestion } from "@/types";

interface LinksListProps {
  links: LinkForIngestion[];
  setLinks: Dispatch<SetStateAction<LinkForIngestion[]>>;
  removeLinkFromList: (id: string) => void;
  highlightedLinkId?: string | null;
}

const LinksList = ({
  links,
  setLinks,
  removeLinkFromList,
  highlightedLinkId,
}: LinksListProps) => {
  const clearList = () => {
    setLinks([]);
  };

  return (
    <>
      <ListHeader onClearListBtnPress={clearList} />
      <ul>
        {links.map(({ id, value }) => (
          <li
            key={id}
            className="mb-3 grid h-10 grid-cols-[1fr_2.5rem] items-center gap-2"
          >
            <p
              className={classNames(
                "link-list-item__url bg-secondary border-border h-10 overflow-hidden rounded border px-3.5 py-2 text-ellipsis whitespace-nowrap",
                {
                  highlighted: id === highlightedLinkId,
                },
              )}
            >
              {value}
            </p>
            <IconButton
              data-testid="delete-link-from-list-button"
              icon="delete"
              variant="destructive"
              aria-label="Delete link from the list"
              onPress={() => removeLinkFromList(id)}
            />
          </li>
        ))}
      </ul>
    </>
  );
};

export default LinksList;
