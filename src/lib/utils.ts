import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract old system RO numbers from text fields.
 * Looks for patterns like "RO G 38569", "RO G38569", "ROG 38569", etc.
 * Returns an array of numeric RO numbers found.
 * 
 * @param text - The text to search (e.g., notes, partDescription)
 * @returns Array of numeric RO numbers found in the text
 */
export function extractOldSystemRONumbers(text: string | null | undefined): number[] {
  if (!text) return [];
  
  // Pattern to match: "RO G 38569", "RO G38569", "ROG 38569", "RO G-38569", etc.
  // Matches: RO (optional space) G (optional space/hyphen) (digits)
  const pattern = /RO\s*G\s*-?\s*(\d+)/gi;
  const matches = text.matchAll(pattern);
  
  const roNumbers: number[] = [];
  for (const match of matches) {
    const roNumber = parseInt(match[1], 10);
    if (!isNaN(roNumber)) {
      roNumbers.push(roNumber);
    }
  }
  
  return roNumbers;
}
