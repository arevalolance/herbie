import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate speed from 3D velocity components
 * @param velocityLongitudinal - Forward/backward velocity in m/s
 * @param velocityLateral - Left/right velocity in m/s  
 * @param velocityVertical - Up/down velocity in m/s
 * @returns Speed in km/h
 */
export function calculateSpeed(
  velocityLongitudinal: number | null | undefined,
  velocityLateral: number | null | undefined,
  velocityVertical: number | null | undefined
): number {
  const vLong = velocityLongitudinal ?? 0;
  const vLat = velocityLateral ?? 0;
  const vVert = velocityVertical ?? 0;
  
  // Calculate 3D velocity magnitude using Pythagorean theorem
  const speedMs = Math.sqrt(
    Math.pow(vLong, 2) + 
    Math.pow(vLat, 2) + 
    Math.pow(vVert, 2)
  );
  
  // Convert m/s to km/h
  return speedMs * 3.6;
}
