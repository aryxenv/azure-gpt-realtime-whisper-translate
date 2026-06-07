import accountLogo from "@/assets/account.svg";
import microsoftLogo from "@/assets/microsoft.svg";
import { cn } from "@/lib/utils";

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-5 shrink-0 items-center gap-2", className)}
      aria-label="Microsoft and Account"
    >
      <img
        src={microsoftLogo}
        alt="Microsoft"
        className="h-full w-auto object-contain"
      />
      <span className="text-xs font-semibold text-muted-foreground">×</span>
      <img
        src={accountLogo}
        alt="Account"
        className="h-full w-auto object-contain"
      />
    </div>
  );
}
