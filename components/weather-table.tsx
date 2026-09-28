"use client";

import { ArrowClockwise, CloudRain, Drop, Gauge, Thermometer, Wind } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { fetchUyoWeather } from "@/lib/api-client";
import type { UyoWeather } from "@/lib/contracts";
import { formatObservedAt, isStale, WEATHER_REFRESH_MS } from "@/lib/weather";

const CACHE_KEY = "sf-last-weather";

type State = { status: "loading" | "success" | "error"; data?: UyoWeather; note?: string };

function readCache(): UyoWeather | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? (JSON.parse(stored) as UyoWeather) : null;
  } catch {
    return null;
  }
}

function writeCache(weather: UyoWeather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(weather));
  } catch {
    /* the table works without a cache */
  }
}

/**
 * `initialWeather` comes from the server render. The component then keeps the
 * observation fresh on an interval and on demand, falling back to the last
 * observation stored on the device when the network is unavailable.
 */
export function WeatherTable({ initialWeather }: { initialWeather: UyoWeather | null }) {
  const { locale, t } = useApp();
  const [state, setState] = useState<State>(
    initialWeather ? { status: "success", data: initialWeather } : { status: "error", note: t.weather.unavailable },
  );
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const data = await fetchUyoWeather({ signal: controller.signal });
      writeCache(data);
      setState({ status: "success", data });
    } catch {
      if (controller.signal.aborted) return;
      const cached = readCache();
      if (cached) {
        // A cached observation is still useful offline, but it is labelled stale.
        setState({ status: "success", data: { ...cached, stale: true }, note: t.weather.lastKnown });
      } else {
        setState({ status: "error", note: t.weather.unavailable });
      }
    }
  }, [t.weather.lastKnown, t.weather.unavailable]);

  // A manual refresh shows the pending state immediately; the interval refresh
  // updates silently so the table does not flicker every ten minutes.
  const refresh = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    void load();
  }, [load]);

  useEffect(() => {
    if (initialWeather) writeCache(initialWeather);
    const interval = window.setInterval(() => void load(), WEATHER_REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      inFlight.current?.abort();
    };
  }, [initialWeather, load]);

  if (state.status === "error" || !state.data) {
    return (
      <div className="weather-card weather-error" role="status">
        <p>{state.note ?? t.weather.unavailable}</p>
        <button className="button-secondary" type="button" onClick={refresh}>
          <ArrowClockwise size={18} aria-hidden="true" /> {t.weather.retry}
        </button>
      </div>
    );
  }

  const weather = state.data;
  const stale = weather.stale || isStale(weather.observed_at);
  const rows = [
    {
      icon: <Thermometer size={20} aria-hidden="true" />,
      label: t.weather.temperature,
      value: `${weather.temperature_c.toFixed(1)} °C`,
      detail: `${t.weather.feelsLike} ${weather.feels_like_c.toFixed(1)} °C`,
    },
    {
      icon: <Drop size={20} aria-hidden="true" />,
      label: t.weather.humidity,
      value: `${weather.humidity_pct}%`,
      detail: `${weather.cloud_cover_pct}% ${t.weather.cloudCover}`,
    },
    {
      icon: <Gauge size={20} aria-hidden="true" />,
      label: t.weather.pressure,
      value: `${weather.pressure_hpa} hPa`,
      detail: t.weather.pressureDetail,
    },
    {
      icon: <Wind size={20} aria-hidden="true" />,
      label: t.weather.wind,
      value: `${weather.wind_speed_ms.toFixed(1)} m/s`,
      detail: t.weather.windDetail,
    },
    {
      icon: <CloudRain size={20} aria-hidden="true" />,
      label: t.weather.rain,
      value: `${weather.rain_1h_mm.toFixed(2)} mm`,
      detail: weather.condition,
    },
  ];

  return (
    <div className="weather-card" aria-live="polite">
      <div className="weather-card-head">
        <div>
          <span className={stale ? "status is-stale" : "status"}>{stale ? t.weather.stale : t.weather.live}</span>
          <h3>{t.weather.cardTitle}</h3>
        </div>
        <button className="icon-button" type="button" onClick={refresh} aria-label={t.weather.refresh}>
          <ArrowClockwise size={18} className={state.status === "loading" ? "spin" : undefined} aria-hidden="true" />
        </button>
      </div>

      <dl className="weather-rows">
        {rows.map((row) => (
          <div className="weather-row" key={row.label}>
            <dt>
              <span className="weather-icon">{row.icon}</span>
              <span>
                {row.label}
                <small>{row.detail}</small>
              </span>
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="weather-foot">
        <span>
          {t.weather.observedAt} {formatObservedAt(weather.observed_at, locale)}
        </span>
        <span>{t.weather.source}</span>
      </div>
      {state.note && <p className="weather-message">{state.note}</p>}
    </div>
  );
}
