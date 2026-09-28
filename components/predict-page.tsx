"use client";

import { PredictionForm } from "@/components/prediction-form";
import { useApp } from "@/components/app-provider";

export function PredictPage() {
  const { t } = useApp();
  return (
    <main id="main">
      <section className="page-hero">
        <div className="section-shell">
          <p className="section-kicker">{t.predict.kicker}</p>
          <h1>{t.predict.title}</h1>
          <p>{t.predict.body}</p>
        </div>
      </section>
      <section className="section">
        <div className="section-shell">
          <PredictionForm />
        </div>
      </section>
    </main>
  );
}
