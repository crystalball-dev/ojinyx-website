import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  label?: string;
  title: string;
  className?: string;
  outline?: boolean;
  as?: "h1" | "h2";
  /** Overrides the default responsive size. */
  titleClassName?: string;
}

export function SectionHeading({ label, title, className, outline = false, as: Tag = "h2", titleClassName }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label ? <span className="label text-muted">{label}</span> : null}
      <Tag className={cn("display", titleClassName ?? "text-[clamp(2.75rem,9vw,8rem)]", outline && "text-outline")}>{title}</Tag>
    </div>
  );
}
