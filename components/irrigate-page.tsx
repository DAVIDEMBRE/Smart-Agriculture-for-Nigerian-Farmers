"use client";

import { IrrigationForm } from "@/components/irrigation-form";
import { useApp } from "@/components/app-provider";

export function IrrigatePage() {
  const { t } = useApp();
  return (
    <main id="main">
      <section className="page-hero">
        <div className="section-shell">
          <p className="section-kicker">{t.irrigate.kicker}</p>
          <h1>{t.irrigate.title}</h1>
          <p>{t.irrigate.body}</p>
        </div>
      </section>
      <section className="section">
        <div className="section-shell">
          <IrrigationForm />
        </div>
      </section>
    </main>
  );
}
