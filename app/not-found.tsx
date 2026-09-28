"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";

export default function NotFound() {
  const { t } = useApp();
  return (
    <main id="main" className="section">
      <div className="section-shell empty-page">
        <p className="section-kicker">{t.errorPage.notFoundKicker}</p>
        <h1 className="section-title">{t.errorPage.notFoundTitle}</h1>
        <p className="section-copy">{t.errorPage.notFoundBody}</p>
        <Link className="button-primary inline-cta" href="/">
          {t.errorPage.home}
        </Link>
      </div>
    </main>
  );
}
