import { useTranslation } from 'react-i18next';
import type { SeriesPoint } from '../types';

interface Props {
  data: SeriesPoint[];
}

const SERIES = [
  { key: 'created' as const, color: '#1d5b45' },
  { key: 'purchased' as const, color: '#2f6f9f' },
  { key: 'signups' as const, color: '#b8791a' },
];

/** Gráfica de barras agrupadas sin dependencias externas */
export function BarChart({ data }: Props) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.flatMap((point) => [point.created, point.purchased, point.signups]));

  return (
    <div data-testid="bar-chart">
      <div className="dash-chart mb-2">
        {data.map((point) => (
          <div className="bar-group" key={point.day} title={point.day}>
            {SERIES.map((series) => (
              <div
                key={series.key}
                className="bar"
                style={{
                  height: `${(point[series.key] / max) * 100}%`,
                  backgroundColor: series.color,
                }}
                aria-label={t('chart.bar', { series: t(`chart.${series.key}`), day: point.day, value: point[series.key] })}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between small text-muted">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>

      <div className="d-flex flex-wrap gap-3 mt-2 small">
        {SERIES.map((series) => (
          <span key={series.key} className="d-flex align-items-center gap-1">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: series.color,
                display: 'inline-block',
              }}
            />
            {t(`chart.${series.key}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
