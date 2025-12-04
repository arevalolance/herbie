import * as React from "react"

import {
  Button as CossButton,
  buttonVariants,
} from "@biotechusa/pdo-ui"
import { cn } from "@workspace/ui/lib/utils"

export type ButtonProps = React.ComponentProps<typeof CossButton> & {
  asChild?: boolean
}

function Button({ asChild = false, children, ...props }: ButtonProps) {
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
    <CossButton render={renderChild} {...props}>
      {renderChild ? undefined : children}
    </CossButton>
  )
}

export { Button, buttonVariants }
