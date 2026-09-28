"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";

export function SiteFooter() {
  const { t } = useApp();
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <p className="footer-title">{t.footer.title}</p>
          <p className="footer-copy">{t.footer.copy}</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/predict">{t.footer.linkPredict}</Link>
          <Link href="/irrigate">{t.footer.linkIrrigate}</Link>
          <Link href="/research">{t.footer.linkResearch}</Link>
          <a href="https://openweathermap.org/api/current" target="_blank" rel="noreferrer">
            {t.footer.linkWeather}
          </a>
        </nav>
        <p className="footer-note">{t.footer.note}</p>
      </div>
    </footer>
  );
}
