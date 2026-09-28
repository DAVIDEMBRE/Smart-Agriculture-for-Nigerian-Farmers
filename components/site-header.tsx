"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Moon, Sun, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { localeRegistry, nextLocale } from "@/lib/content";

export function SiteHeader() {
  const { locale, setLocale, theme, toggleTheme, t } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    ["/", t.nav.home],
    ["/predict", t.nav.predict],
    ["/irrigate", t.nav.irrigate],
    ["/research", t.nav.research],
  ] as const;

  const target = nextLocale(locale);
  const targetLabel = localeRegistry[target].label;

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">{t.nav.skipToContent}</a>
      <div className="nav-shell">
        <Link href="/" className="brand" aria-label={`${t.nav.brand} ${t.nav.brandTagline}`}>
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            {t.nav.brand}
            <small>{t.nav.brandTagline}</small>
          </span>
        </Link>

        <nav id="primary-navigation" className={open ? "nav-links is-open" : "nav-links"} aria-label="Primary">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Language and theme stay outside the collapsible drawer so they are
            reachable on a phone without opening the menu first. */}
        <div className="nav-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => setLocale(target)}
            aria-label={`${t.nav.switchTo} ${targetLabel}`}
            lang={localeRegistry[target].htmlLang}
          >
            {localeRegistry[target].nativeLabel}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? t.nav.useDarkTheme : t.nav.useLightTheme}
            aria-pressed={theme === "dark"}
          >
            {theme === "light" ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
          </button>
        </div>

        <button
          type="button"
          className="menu-button"
          aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </div>
    </header>
  );
}
