import type { RiskRadarScores } from "@/lib/types";

const AXES: { key: keyof RiskRadarScores; label: string }[] = [
  { key: "financial", label: "재무" },
  { key: "market", label: "시장" },
  { key: "operational", label: "운영" },
];

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 85;

function pointFor(index: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  const r = ratio * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function ringPoints(ratio: number): string {
  return AXES.map((_, i) => pointFor(i, ratio).join(",")).join(" ");
}

export function RiskRadarChart({ scores }: { scores: RiskRadarScores }) {
  const dataPoints = AXES.map((axis, i) => pointFor(i, scores[axis.key] / 100).join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[280px] text-zinc-200 dark:text-zinc-700"
      role="img"
      aria-label={`리스크 레이더: 재무 ${scores.financial}, 시장 ${scores.market}, 운영 ${scores.operational}`}
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon key={ratio} points={ringPoints(ratio)} fill="none" stroke="currentColor" strokeWidth={1} />
      ))}
      {AXES.map((axis) => {
        const [x, y] = pointFor(AXES.indexOf(axis), 1);
        return <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" strokeWidth={1} />;
      })}
      <polygon points={dataPoints} fill="rgb(99 102 241 / 0.35)" stroke="rgb(99 102 241)" strokeWidth={2} />
      {AXES.map((axis, i) => {
        const [x, y] = pointFor(i, 1.22);
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-zinc-700 text-[11px] font-medium dark:fill-zinc-200"
          >
            {axis.label} {scores[axis.key]}
          </text>
        );
      })}
    </svg>
  );
}
