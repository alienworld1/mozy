"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { educationResource, primaryNavigation } from "@/lib/navigation";

export function ProductNavigation() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Product"
      className="min-w-0 overflow-x-auto lg:overflow-visible"
    >
      <div className="flex min-w-max lg:block lg:min-w-0">
        <ul
          aria-label="Primary navigation"
          className="flex lg:min-w-0 lg:flex-col lg:gap-1"
        >
          {primaryNavigation.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="relative lg:w-full">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center px-4 text-sm font-medium outline-none transition-colors focus-visible:bg-wash lg:px-6 ${
                    active
                      ? "bg-wash text-ink"
                      : "text-ink-secondary hover:text-ink"
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
        <div className="mx-4 hidden border-t border-line pt-3 lg:mt-5 lg:block">
          <Link
            href={educationResource.href}
            aria-current={
              pathname === educationResource.href ? "page" : undefined
            }
            className="flex min-h-11 items-center text-xs font-medium text-ink-tertiary outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            {educationResource.label}
          </Link>
        </div>
        <Link
          href={educationResource.href}
          aria-current={
            pathname === educationResource.href ? "page" : undefined
          }
          className="inline-flex min-h-11 items-center border-l border-line px-4 text-xs font-medium text-ink-tertiary outline-none transition-colors hover:text-ink focus-visible:bg-wash lg:hidden"
        >
          {educationResource.label}
        </Link>
      </div>
    </nav>
  );
}
