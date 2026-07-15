import { useEffect, useRef } from "react";
import { X, Heart, Download, Calendar, Eye, Tag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ImageItem } from "@/lib/types";

interface ImagePreviewModalProps {
  image: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  showUserInfo?: boolean;
  actions?: React.ReactNode;
}

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  if (!value) return "未知时间";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getAvatarFallback(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

export function ImagePreviewModal({
  image,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  showUserInfo = false,
  actions,
}: ImagePreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and ESC key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button on open
    closeButtonRef.current?.focus();

    // Handle ESC key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Handle arrow keys for navigation
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleArrowKeys);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleArrowKeys);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, onPrevious, onNext]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab);
    return () => modal.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="dark fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      ref={modalRef}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative z-10 flex h-full w-full max-w-7xl flex-col p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            {showUserInfo && image.user ? (
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border-2 border-white/10">
                  {image.user.avatarUrl ? (
                    <AvatarImage src={image.user.avatarUrl} alt={image.user.username} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-800 text-white">
                    {getAvatarFallback(image.user.username)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-white">{image.user.username}</h3>
                  {image.user.bio ? (
                    <p className="text-sm text-zinc-400 line-clamp-1">{image.user.bio}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <h2 id="preview-title" className="text-xl font-bold text-white">
                {image.title}
              </h2>
            )}
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="secondary"
            size="icon-lg"
            onClick={onClose}
            className="ml-4"
            aria-label="关闭预览"
          >
            <X size={24} aria-hidden="true" />
          </Button>
        </div>

        {/* Image Container */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <img
            src={image.url}
            alt={image.title}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            loading="eager"
          />

          {/* Navigation Arrows */}
          {onPrevious && (
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              onClick={onPrevious}
              className="absolute left-4"
              aria-label="上一张"
            >
              <svg
                className="size-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
          )}
          {onNext && (
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              onClick={onNext}
              className="absolute right-4"
              aria-label="下一张"
            >
              <svg
                className="size-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          )}
        </div>

        {/* Footer - Info and Actions */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* Image Info */}
          <div className="flex-1 space-y-3">
            {showUserInfo && (
              <h2 className="text-xl font-bold text-white">{image.title}</h2>
            )}
            {image.description && (
              <p className="text-sm text-zinc-300 line-clamp-2">{image.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Heart size={16} aria-hidden="true" />
                {formatCount(image.likes)} 点赞
              </span>
              {image.views !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={16} aria-hidden="true" />
                  {formatCount(image.views)} 浏览
                </span>
              )}
              {image.uploadedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={16} aria-hidden="true" />
                  {formatDate(image.uploadedAt)}
                </span>
              )}
            </div>
            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag size={14} className="text-zinc-500" aria-hidden="true" />
                {image.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                aria-label="下载图片"
              >
                <Download size={18} aria-hidden="true" />
                下载
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label="点赞"
              >
                <Heart size={18} aria-hidden="true" />
                点赞
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
