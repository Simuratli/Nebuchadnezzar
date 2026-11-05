"use client";

import * as Slider from "@radix-ui/react-slider";
import { useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useEffect, useRef } from "react";
import { addYears, formatYear, indexToYear, MAX_YEAR, MIN_YEAR, yearToIndex } from "@/lib/year";
import { SPEEDS, useAtlas, WINDOWS } from "@/store/atlas";

const TICKS = [-500, 1, 500, 1000, 1500, 1950];
// The slider is narrow on phones, where only these labels fit.
const PHONE_TICKS = new Set([-500, 1000, 1950]);
const MIN_INDEX = yearToIndex(MIN_YEAR);
const MAX_INDEX = yearToIndex(MAX_YEAR);
const tickPosition = (year: number) => ((yearToIndex(year) - MIN_INDEX) / (MAX_INDEX - MIN_INDEX)) * 100;

function usePlayback() {
  const playing = useAtlas((s) => s.playing);
  const speed = useAtlas((s) => s.speed);
  const carry = useRef(0);
  useEffect(() => {
    if (!playing) return;
    carry.current = 0;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      carry.current += (speed * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(carry.current);
      if (whole < 1) return;
      carry.current -= whole;
      const { year, setYear, setPlaying } = useAtlas.getState();
      const next = addYears(year, whole);
      setYear(next);
      if (next >= MAX_YEAR) setPlaying(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed]);
}

type Props = {
  yearKey?: "year" | "year2";
  note?: string;
  compact?: boolean;
  sliderLabel?: string;
};

export function TimeBar({ yearKey = "year", note, compact = false, sliderLabel }: Props) {
  const t = useTranslations("timeline");
  const era = useEra();
  const year = useAtlas((s) => s[yearKey]);
  const playing = useAtlas((s) => s.playing);
  const speed = useAtlas((s) => s.speed);
  const windowYears = useAtlas((s) => s.windowYears);
  const setYear = useAtlas((s) => (yearKey === "year" ? s.setYear : s.setYear2));
  const setPlaying = useAtlas((s) => s.setPlaying);
  const setSpeed = useAtlas((s) => s.setSpeed);
  const setWindowYears = useAtlas((s) => s.setWindowYears);
  const label = formatYear(year, era);

  const togglePlay = () => {
    // Pressing play at the end restarts instead of doing nothing.
    if (!playing && year >= MAX_YEAR) setYear(MIN_YEAR);
    setPlaying(!playing);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {!compact && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? t("pause") : t("play")}
            aria-pressed={playing}
            data-testid="play"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5l11 7-11 7z" />}
            </svg>
          </button>
        )}
        <output
          data-testid={`year-label-${yearKey}`}
          aria-live={playing ? "off" : "polite"}
          className="w-24 shrink-0 font-serif text-xl font-semibold tabular-nums"
        >
          {label}
        </output>
        <div className="relative min-w-0 flex-1 pb-5 pt-1">
          <Slider.Root
            className="relative flex h-6 w-full touch-none select-none items-center"
            min={MIN_INDEX}
            max={MAX_INDEX}
            step={1}
            value={[yearToIndex(year)]}
            onValueChange={([v]) => setYear(indexToYear(v))}
            aria-label={sliderLabel ?? t("slider")}
          >
            <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
              <Slider.Range className="absolute h-full rounded-full bg-accent" />
            </Slider.Track>
            <Slider.Thumb
              data-testid={`slider-${yearKey}`}
              aria-label={sliderLabel ?? t("slider")}
              aria-valuetext={label}
              className="block h-5 w-5 rounded-full border-2 border-accent bg-surface shadow"
            />
          </Slider.Root>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-4 text-[11px] text-muted">
            {TICKS.map((tick) => (
              <span
                key={tick}
                data-testid="tick"
                className={`absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full ${PHONE_TICKS.has(tick) ? "" : "hidden md:inline"}`} style={{ left: `${tickPosition(tick)}%` }}>
                {formatYear(tick, era)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <label className="flex items-center gap-1">
            {t("speed")}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              data-testid="speed"
              className="rounded border border-line bg-surface px-1 py-0.5 text-ink"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s} {t("speedUnit")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1" title={t("windowHint")}>
            {t("window")}
            <select
              value={windowYears}
              onChange={(e) => setWindowYears(Number(e.target.value))}
              data-testid="window"
              className="rounded border border-line bg-surface px-1 py-0.5 text-ink"
            >
              {WINDOWS.map((w) => (
                <option key={w} value={w}>
                  ±{w}
                </option>
              ))}
            </select>
          </label>
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  );
}

export { usePlayback };
