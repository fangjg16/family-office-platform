import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /** 落地页导航：青蓝渐变 pill */
        landingCta:
          "rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_0_16px_rgba(14,165,233,0.35)] transition-all hover:-translate-y-px hover:shadow-[0_0_28px_rgba(14,165,233,0.45)] active:scale-[0.98]",
        landingGhost:
          "rounded-full border border-white/10 bg-white/[0.04] text-[hsl(214_32%_91%)] backdrop-blur-md transition-all hover:border-sky-400/25 hover:bg-sky-500/10",
        /** 工作台浅色玻璃按钮 */
        navCta:
          "rounded-full border border-border/80 bg-white/80 text-foreground shadow-sm backdrop-blur-md hover:bg-white active:scale-[0.98] transition-all uppercase text-xs tracking-widest px-5",
        hero:
          "rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:brightness-110 active:scale-[0.97] transition-all",
        heroOutline:
          "rounded-full border border-border/80 bg-white/70 text-foreground shadow-sm backdrop-blur-md hover:bg-white active:scale-[0.97] transition-all",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
