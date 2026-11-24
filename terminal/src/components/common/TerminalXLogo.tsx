/**
 * TerminalXLogo.tsx
 * Official TerminalX Institutional Brand Logo.
 * Features the signature X mark with ascending candlestick breakouts and directional arrow.
 * ZERO NEON POLICY strictly enforced: Monochromatic, matte, institutional styling.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React from 'react';

interface TerminalXLogoProps {
  size?: number | string;
  className?: string;
  variant?: 'white' | 'dark' | 'current';
  showText?: boolean;
  textClassName?: string;
}

export default function TerminalXLogo({
  size = 28,
  className = '',
  variant = 'white',
  showText = false,
  textClassName = '',
}: TerminalXLogoProps) {
  const colorClass =
    variant === 'dark'
      ? 'text-neutral-900'
      : variant === 'white'
      ? 'text-white'
      : 'text-current';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        fill="currentColor"
        fillRule="evenodd"
        className={`shrink-0 transition-colors ${colorClass}`}
        aria-label="TerminalX Logo"
      >
        <path d="M 526 624 L 627 740 L 797 740 L 757 693 L 611 528 L 587 555 L 587 622 L 630 623 L 629 643 L 565 642 L 565 580 Z M 226 740 L 396 740 L 628 475 L 795 287 L 797 283 L 628 283 L 518 408 L 511 414 L 395 283 L 226 283 L 229 288 L 426 510 L 426 512 L 395 547 L 395 585 L 415 585 L 436 561 L 437 421 L 452 421 L 453 380 L 463 381 L 463 421 L 479 422 L 479 511 L 542 440 L 523 424 L 522 420 L 593 396 L 594 401 L 588 430 L 582 471 L 579 473 L 558 454 L 425 606 L 373 605 L 373 529 L 357 528 L 357 488 L 348 488 L 347 529 L 332 529 L 331 668 L 309 667 L 309 621 L 295 621 L 293 619 L 294 615 L 293 584 L 284 584 L 284 619 L 282 621 L 268 621 L 268 691 Z" />
      </svg>
      {showText && (
        <span className={`font-heading font-black tracking-wider ${textClassName || 'text-white text-sm'}`}>
          TERMINALX
        </span>
      )}
    </div>
  );
}
