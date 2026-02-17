'use client';

import React from 'react';
import {
  SortableTree,
  SimpleTreeItemWrapper,
} from 'dnd-kit-sortable-tree';
import { cn } from '@/lib/utils';

export interface SortableTreeNode {
  id: string;
  children?: SortableTreeNode[];
  [key: string]: any; // Allow additional properties
}

interface SortableTreeWrapperProps<T extends SortableTreeNode> {
  items: T[];
  onItemsChange: (items: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  collapsible?: boolean;
  indicator?: boolean;
  indentationWidth?: number;
  className?: string;
}

/**
 * Reusable Sortable Tree Component using dnd-kit-sortable-tree
 *
 * Features:
 * - Drag & drop with smooth animations
 * - Horizontal indent control (drag left/right to change nesting level)
 * - Vertical reordering
 * - Collapsible branches
 * - Accessible (keyboard navigation, screen reader support)
 *
 * Usage:
 * ```tsx
 * <SortableTreeWrapper
 *   items={menuItems}
 *   onItemsChange={setMenuItems}
 *   renderItem={(item) => <div>{item.label}</div>}
 *   collapsible
 *   indentationWidth={24}
 * />
 * ```
 */
export function SortableTreeWrapper<T extends SortableTreeNode>({
  items,
  onItemsChange,
  renderItem,
  collapsible = true,
  indicator = true,
  indentationWidth = 24,
  className,
}: SortableTreeWrapperProps<T>) {
  // Create TreeItemComponent with forwardRef (required by library)
  const TreeItemComponent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    // Extract only valid props for SimpleTreeItemWrapper
    const {
      childCount,
      clone,
      depth,
      disableSelection,
      disableSorting,
      ghost,
      handleProps,
      indentationWidth: _indentationWidth,
      indicator: _indicator,
      collapsed,
      onCollapse,
      onRemove,
      wrapperRef,
      ...rest
    } = props;

    return (
      <SimpleTreeItemWrapper
        childCount={childCount}
        clone={clone}
        depth={depth}
        disableSelection={disableSelection}
        disableSorting={disableSorting}
        ghost={ghost}
        handleProps={handleProps}
        indentationWidth={_indentationWidth}
        indicator={_indicator}
        collapsed={collapsed}
        onCollapse={onCollapse}
        onRemove={onRemove}
        wrapperRef={wrapperRef}
        ref={ref}
        showDragHandle={false}
      >
        {renderItem(props.item)}
      </SimpleTreeItemWrapper>
    );
  });
  TreeItemComponent.displayName = 'TreeItemComponent';

  return (
    <div className={cn('sortable-tree-wrapper', className)}>
      <SortableTree
        items={items}
        onItemsChanged={onItemsChange}
        TreeItemComponent={TreeItemComponent}
        indentationWidth={indentationWidth}
        indicator={indicator}
        collapsible={collapsible}
      />
    </div>
  );
}
