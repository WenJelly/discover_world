import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostVisibilityValue } from "./postVisibility";

type PostVisibilityOption = {
  value: PostVisibilityValue;
  label: string;
  icon: typeof Globe2;
};

export type PostVisibilityMenuProps = {
  value: PostVisibilityValue;
  onChange: (value: PostVisibilityValue) => void;
  ariaLabel: string;
  disabled?: boolean;
  loading?: boolean;
  buttonClassName?: string;
  menuClassName?: string;
};

const visibilityOptions: PostVisibilityOption[] = [
  { value: "public", label: "公开", icon: Globe2 },
  { value: "private", label: "仅自己可见", icon: Lock },
];

export function PostVisibilityMenu({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  loading = false,
  buttonClassName,
  menuClassName,
}: PostVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected =
    visibilityOptions.find((option) => option.value === value) ??
    visibilityOptions[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 min-w-[7.5rem] items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName
        )}
      >
        <SelectedIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">
          {selected.label}
        </span>
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-xs shadow-lg",
            menuClassName
          )}
        >
          {visibilityOptions.map((item) => {
            const Icon = item.icon;
            const optionSelected = value === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={optionSelected}
                onClick={() => {
                  setOpen(false);
                  if (!optionSelected) {
                    onChange(item.value);
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  optionSelected && "bg-muted text-foreground"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {optionSelected ? <Check className="size-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
