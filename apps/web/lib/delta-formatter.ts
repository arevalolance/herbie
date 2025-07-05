/**
 * Utility functions for formatting delta time values in a racing context
 */

/**
 * Format a delta time value for display
 * @param delta - Delta time in seconds (positive = slower, negative = faster)
 * @returns Formatted string with sign and proper precision
 */
export function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return "--";
  }

  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(3)}s`;
}

/**
 * Format delta with color class based on performance
 * @param delta - Delta time in seconds
 * @returns Object with formatted text and CSS class
 */
export function formatDeltaWithColor(delta: number | null | undefined): {
  text: string;
  className: string;
} {
  const text = formatDelta(delta);
  
  if (delta === null || delta === undefined || isNaN(delta)) {
    return { text, className: "text-muted-foreground" };
  }

  const className = delta < 0 
    ? "text-green-600 dark:text-green-400" // Faster = green
    : delta > 0 
    ? "text-red-600 dark:text-red-400"     // Slower = red
    : "text-muted-foreground";             // Equal = neutral

  return { text, className };
}

/**
 * Format delta for track map tooltip
 * @param delta - Delta time in seconds
 * @returns Short formatted string for tooltips
 */
export function formatDeltaForTooltip(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return "--";
  }

  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}s`;
}

/**
 * Get a descriptive label for delta performance
 * @param delta - Delta time in seconds
 * @returns Human readable description
 */
export function getDeltaDescription(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return "No comparison data";
  }

  if (delta < -1) return "Much faster";
  if (delta < -0.1) return "Faster";
  if (delta < 0.1) return "Very close";
  if (delta < 1) return "Slower";
  return "Much slower";
}