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
        /** 落地页：酒红主按钮 */
        landingCta:
          "rounded-sm bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(5_32%_46%/0.22)] transition-all hover:bg-[hsl(5_34%_40%)] active:scale-[0.99]",
        /** 落地页 Hero：毛玻璃主按钮 */
        landingGlass:
          "glass-bohemian-hero glass-bohemian-hero-btn rounded-sm text-[hsl(var(--hero-foreground))] active:scale-[0.99]",
        /** 落地页 Hero 深色底：描边幽灵按钮 */
        landingGhost:
          "rounded-[var(--glass-hero-radius)] border border-[var(--glass-hero-border)] bg-[rgba(255,248,240,0.04)] text-[hsl(36_28%_92%)] backdrop-blur-[24px] backdrop-saturate-[125%] transition-all hover:border-[rgba(255,248,240,0.16)] hover:bg-[rgba(255,248,240,0.07)]",
        /** 落地页米色正文区 / 导航：描边幽灵按钮 */
        landingGhostLight:
          "rounded-sm border border-[hsl(5_32%_46%/0.35)] bg-white/30 text-[hsl(5_28%_38%)] backdrop-blur-md transition-all hover:border-[hsl(5_32%_46%/0.5)] hover:bg-white/50",
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
