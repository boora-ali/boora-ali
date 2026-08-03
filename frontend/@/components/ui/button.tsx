/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border-[3px] border-foreground text-sm font-bold ring-offset-background shadow-[4px_4px_0_#000] transition-[transform,box-shadow,background-color,color] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 dark:shadow-[4px_4px_0_#fff] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none",
        outline:
          "bg-background hover:translate-x-1 hover:translate-y-1 hover:bg-accent hover:text-accent-foreground hover:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground hover:translate-x-1 hover:translate-y-1 hover:bg-secondary/80 hover:shadow-none",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
