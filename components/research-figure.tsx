"use client";

import Image from "next/image";
import { ArrowsOut, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";

type ResearchFigureProps = {
  src: string;
  alt: string;
  caption: string;
  source: string;
  method: string;
  width: number;
  height: number;
};

/**
 * A research figure with its provenance attached, expandable into a native
 * dialog so the full-resolution export can be inspected without leaving the
 * page. The dialog is closed on Escape by the platform.
 */
export function ResearchFigure({ src, alt, caption, source, method, width, height }: ResearchFigureProps) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <figure className="figure-card">
      <button type="button" className="figure-expand" onClick={() => setOpen(true)}>
        <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 900px) 100vw, 48vw" />
        <span className="figure-expand-hint">
          <ArrowsOut size={18} aria-hidden="true" /> {t.research.figureExpand}
        </span>
      </button>
      <figcaption>
        <p className="figure-caption">{caption}</p>
        <p className="figure-meta">
          <b>{t.research.figureSource}:</b> {source}
        </p>
        <p className="figure-meta">
          <b>{t.research.figureMethod}:</b> {method}
        </p>
      </figcaption>

      {/* The full-resolution export is only mounted while the dialog is open,
          so a closed dialog does not carry a second copy of the image. */}
      <dialog ref={dialogRef} className="figure-dialog" onClose={() => setOpen(false)} aria-label={caption}>
        {open && (
          <>
            <button
              type="button"
              className="icon-button figure-dialog-close"
              onClick={() => setOpen(false)}
              aria-label={t.research.figureClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
            <Image src={src} alt={alt} width={width} height={height} sizes="92vw" />
            <p>{caption}</p>
          </>
        )}
      </dialog>
    </figure>
  );
}
