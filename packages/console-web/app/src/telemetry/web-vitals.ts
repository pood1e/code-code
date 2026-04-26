import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

export type WebVitalName = "cls" | "fcp" | "inp" | "lcp" | "ttfb";

export type WebVitalMeasurement = {
  name: WebVitalName;
  value: number;
  id: string;
  rating: string;
  navigationType: string;
};

type WebVitalHandler = (measurement: WebVitalMeasurement) => void;

export function registerWebVitals(handler: WebVitalHandler) {
  onCLS((metric) => {
    handler(toMeasurement("cls", metric));
  }, { reportAllChanges: true });
  onFCP((metric) => {
    handler(toMeasurement("fcp", metric));
  }, { reportAllChanges: true });
  onINP((metric) => {
    handler(toMeasurement("inp", metric));
  }, { reportAllChanges: true });
  onLCP((metric) => {
    handler(toMeasurement("lcp", metric));
  }, { reportAllChanges: true });
  onTTFB((metric) => {
    handler(toMeasurement("ttfb", metric));
  }, { reportAllChanges: true });
}

function toMeasurement(name: WebVitalName, metric: Metric): WebVitalMeasurement {
  return {
    name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
  };
}
