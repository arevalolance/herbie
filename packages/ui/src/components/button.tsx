import * as React from "react"

import {
  Button as CossButton,
  buttonVariants,
} from "@biotechusa/pdo-ui"
import { cn } from "@workspace/ui/lib/utils"

export type ButtonProps = React.ComponentProps<typeof CossButton> & {
  asChild?: boolean
}

function mergeRefs<T = unknown>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (!ref) return

      if (typeof ref === "function") {
        ref(value)
      } else {
        ;(ref as React.MutableRefObject<T | null>).current = value
      }
    })
  }
}

const Button = React.forwardRef<React.ElementRef<typeof CossButton>, ButtonProps>(
  ({ asChild = false, children, ...props }, forwardedRef) => {
    const renderChild =
      asChild && React.isValidElement(children)
        ? (renderProps: Record<string, unknown>) => {
            const { ref: renderRef, className, ...rest } = renderProps as {
              ref?: React.Ref<HTMLButtonElement>
              className?: string
            }

            const childClassName = (children.props as { className?: string }).className
            const childRef = (children as { ref?: React.Ref<HTMLButtonElement> }).ref

            const composedRef = mergeRefs<HTMLButtonElement>(
              renderRef,
              childRef,
              forwardedRef as React.Ref<HTMLButtonElement>
            )

            return React.cloneElement(children, {
              ...rest,
              ref: composedRef,
              className: cn(className, childClassName),
            })
          }
        : undefined

    return (
      <CossButton
        ref={asChild ? undefined : forwardedRef}
        render={renderChild}
        {...props}
      >
        {renderChild ? undefined : children}
      </CossButton>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
