import * as React from "react"

import { Badge as CossBadge, badgeVariants } from "@biotechusa/pdo-ui"
import { cn } from "@workspace/ui/lib/utils"

export type BadgeProps = React.ComponentProps<typeof CossBadge> & {
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

const Badge = React.forwardRef<React.ElementRef<typeof CossBadge>, BadgeProps>(
  ({ asChild = false, children, ...props }, forwardedRef) => {
    const renderChild =
      asChild && React.isValidElement(children)
        ? (renderProps: Record<string, unknown>) => {
            const { ref: renderRef, className, ...rest } = renderProps as {
              ref?: React.Ref<HTMLDivElement>
              className?: string
            }

            const childClassName = (children.props as { className?: string }).className
            const childRef = (children as { ref?: React.Ref<HTMLDivElement> }).ref

            const composedRef = mergeRefs<HTMLDivElement>(
              renderRef,
              childRef,
              forwardedRef as React.Ref<HTMLDivElement>
            )

            return React.cloneElement(children, {
              ...rest,
              ref: composedRef,
              className: cn(className, childClassName),
            })
          }
        : undefined

    return (
      <CossBadge
        ref={asChild ? undefined : forwardedRef}
        render={renderChild}
        {...props}
      >
        {renderChild ? undefined : children}
      </CossBadge>
    )
  }
)

Badge.displayName = "Badge"

export { Badge, badgeVariants }
