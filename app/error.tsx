"use client";

import { useApp } from "@/components/app-provider";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useApp();
  return (
    <main id="main" className="section">
      <div className="section-shell empty-page">
        <p className="section-kicker">{t.errorPage.kicker}</p>
        <h1 className="section-title">{t.errorPage.title}</h1>
        <p className="section-copy">{t.errorPage.body}</p>
        <button className="button-primary inline-cta" type="button" onClick={reset}>
          {t.errors.tryAgain}
        </button>
      </div>
    </main>
  );
}
