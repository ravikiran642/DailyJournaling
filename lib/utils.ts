import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the local calendar date in YYYY-MM-DD format using the user's
 * local timezone rather than UTC.
 */
export function getLocalCalendarDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string, returning a new YYYY-MM-DD string.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return getLocalCalendarDate();
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalCalendarDate(date);
}

/**
 * Returns a short formatted date (e.g. "Sep 5" or "Today", "Yesterday").
 */
export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const today = getLocalCalendarDate();
  const yesterday = addDaysToDate(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  return dateStr;
}

/**
 * Formats a calendar date (YYYY-MM-DD) or ISO date string into a friendly
 * localized display string without UTC-offset day shifts.
 */
export function formatJournalDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Strips HTML tags and collapses whitespace to return a clean snippet of text.
 */
export function getCleanSnippet(htmlOrText?: string): string {
  if (!htmlOrText) return "";
  return htmlOrText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

