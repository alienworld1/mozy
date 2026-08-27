"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { primaryNavigation } from "@/lib/navigation";

export function ProductNavigation() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Primary" className="min-w-0 overflow-x-auto lg:overflow-visible">
      <ul className="flex min-w-max lg:min-w-0 lg:flex-col lg:gap-1">
        {primaryNavigation.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="relative lg:w-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-11 items-center px-4 text-sm font-medium outline-none transition-colors focus-visible:bg-wash lg:px-6 ${
                  active ? "bg-wash text-ink" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {active ? (
                  <m.span
                    layoutId="active-route-registration"
                    aria-hidden="true"
                    className="absolute inset-x-4 bottom-0 h-0.5 bg-signal lg:inset-y-2 lg:left-0 lg:right-auto lg:h-auto lg:w-0.5"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                    }
                  />
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
