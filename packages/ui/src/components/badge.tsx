import * as React from "react"

import { Badge as CossBadge, badgeVariants } from "@biotechusa/pdo-ui"
import { cn } from "@workspace/ui/lib/utils"

export type BadgeProps = React.ComponentProps<typeof CossBadge> & {
  asChild?: boolean
}

function Badge({ asChild = false, children, ...props }: BadgeProps) {
  const renderChild =
    asChild && React.isValidElement(children)
      ? (renderProps: Record<string, unknown>) =>
          React.cloneElement(children, {
            ...renderProps,
            className: cn(
              (renderProps as { className?: string }).className,
              (children.props as { className?: string }).className
            ),
          })
      : undefined

  return (
    <CossBadge render={renderChild} {...props}>
      {renderChild ? undefined : children}
    </CossBadge>
  )
}

export { Badge, badgeVariants }
