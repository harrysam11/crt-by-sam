/**
 * Standard Institutional Card Component System.
 * Adheres strictly to structural, stylistic, and interaction constraints:
 * - Structural: 1 primary icon/image, short title (~5 words), 1 line muted metadata,
 *   single primary action button, at most 1 quiet secondary action. Equal heights, 16-24px padding.
 * - Stylistic: Neutral surface (#101016), 1px border (#262634), soft shadow, exactly one accent color (#38bdf8).
 *   Named monospace/clean sans typography. Strict ban on glassmorphism, purple gradients, and blob backgrounds.
 * - Interaction: 60fps micro-interactions, hover slight lift (-2px), focus-visible ring,
 *   loading skeleton screen, prefers-reduced-motion fallback.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { ReactNode } from 'react';

export interface StandardCardProps {
  icon: ReactNode;
  title: string;
  meta: string;
  badge?: string;
  badgeColor?: 'default' | 'accent' | 'emerald' | 'amber';
  primaryAction: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    active?: boolean;
    icon?: ReactNode;
  };
  className?: string;
  testId?: string;
}

export function StandardCard({
  icon,
  title,
  meta,
  badge,
  badgeColor = 'default',
  primaryAction,
  secondaryAction,
  className = '',
  testId,
}: StandardCardProps) {
  const badgeClasses = {
    default: 'bg-[#181824] text-slate-400 border-[#2a2a3c]',
    accent: 'bg-[#0c2438] text-[#38bdf8] border-[#18496e]',
    emerald: 'bg-[#0d281e] text-emerald-400 border-[#1b4d3a]',
    amber: 'bg-[#291e0a] text-amber-400 border-[#4a3512]',
  }[badgeColor];

  return (
    <div
      data-testid={testId}
      className={`group relative flex h-full flex-col justify-between rounded-xl bg-[#101016] p-4 border border-[#262634] shadow-md shadow-black/40 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#38bdf8]/60 focus-within:ring-2 focus-within:ring-[#38bdf8] focus-within:ring-offset-2 focus-within:ring-offset-[#101016] motion-reduce:transform-none motion-reduce:transition-none ${className}`}
    >
      {/* Top Section: Icon & Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#181824] border border-[#2a2a3c] text-[#38bdf8]">
            {icon}
          </div>
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border uppercase tracking-wider ${badgeClasses}`}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-mono text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-white transition-colors">
          {title}
        </h3>

        {/* Muted Metadata */}
        <p className="mt-1 font-mono text-xs text-slate-400 line-clamp-1" title={meta}>
          {meta}
        </p>
      </div>

      {/* Bottom Section: Primary Action & Quiet Secondary Link */}
      <div className="mt-4 pt-3 border-t border-[#1d1d28] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          className={`flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${
            primaryAction.active
              ? 'bg-[#38bdf8] text-black font-semibold shadow-sm'
              : 'bg-[#181824] text-[#38bdf8] border border-[#2a2a3c] hover:bg-[#38bdf8] hover:text-black hover:border-[#38bdf8]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {primaryAction.label}
        </button>

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className={`p-1.5 rounded-lg font-mono text-xs transition-colors ${
              secondaryAction.active
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={secondaryAction.label}
          >
            {secondaryAction.icon || secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Standard Responsive Grid for Cards.
 * 3 columns on desktop (lg), 2 on tablet (md), 1 on mobile, uniform 16px (gap-4) spacing.
 */
export function StandardCardGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Loading Skeleton Screen for StandardCard.
 */
export function StandardCardSkeleton() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-[#101016] p-4 border border-[#262634] shadow-md shadow-black/40 animate-pulse">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-[#181824]" />
          <div className="h-4 w-12 rounded bg-[#181824]" />
        </div>
        <div className="h-4 w-3/4 rounded bg-[#181824]" />
        <div className="mt-2 h-3 w-1/2 rounded bg-[#181824]" />
      </div>
      <div className="mt-4 pt-3 border-t border-[#1d1d28] flex items-center justify-between gap-2">
        <div className="h-7 flex-1 rounded-lg bg-[#181824]" />
        <div className="h-7 w-7 rounded-lg bg-[#181824]" />
      </div>
    </div>
  );
}
