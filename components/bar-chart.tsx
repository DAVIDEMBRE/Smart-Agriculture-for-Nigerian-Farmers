"use client";

/**
 * A dependency-free horizontal bar chart rendered as a real table.
 *
 * The table markup is what screen readers and keyboard users get; the bars are
 * decorative widths layered on top of the value cell. Rebuilding the
 * dissertation's exported chart images this way keeps the numbers selectable,
 * searchable and legible at every breakpoint without shipping a chart library.
 */

export type BarDatum = {
  label: string;
  value: number;
  /** Text shown in the value column; defaults to the raw value. */
  display?: string;
  /** Optional secondary label rendered inside the bar. */
  annotation?: string;
  highlight?: boolean;
};

type BarChartProps = {
  caption: string;
  columnLabel: string;
  valueLabel: string;
  data: BarDatum[];
  /** Bars are drawn relative to this value. Defaults to the largest datum. */
  max?: number;
  /**
   * Lower bound of the drawn scale. Accuracies clustered between 0.96 and 1.0
   * are unreadable on a 0-based axis, so the caller can zoom the baseline and
   * the chart states that it has done so.
   */
  min?: number;
};

export function BarChart({ caption, columnLabel, valueLabel, data, max, min = 0 }: BarChartProps) {
  const upper = max ?? Math.max(...data.map((item) => item.value));
  const span = upper - min || 1;

  return (
    <table className="bar-chart">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{columnLabel}</th>
          <th scope="col" className="bar-chart-plot">
            <span className="visually-hidden">{valueLabel}</span>
          </th>
          <th scope="col" className="bar-chart-value">
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => {
          const ratio = Math.max(0.02, Math.min(1, (item.value - min) / span));
          return (
            <tr key={item.label} className={item.highlight ? "is-highlighted" : undefined}>
              <th scope="row">{item.label}</th>
              <td className="bar-chart-plot">
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${ratio * 100}%` }}>
                    {item.annotation && <span className="bar-annotation">{item.annotation}</span>}
                  </span>
                </span>
              </td>
              <td className="bar-chart-value">{item.display ?? item.value}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
