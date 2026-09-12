import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-navy/15 bg-white px-3 text-base text-navy shadow-sm placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[220px] w-full rounded-md border border-navy/15 bg-white px-3 py-3 text-base text-navy shadow-sm placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-navy/80", className)} {...props} />;
}
