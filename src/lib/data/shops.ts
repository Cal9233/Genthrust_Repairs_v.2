/**
 * Shop data access functions.
 * Safe for use in Trigger.dev tasks (no auth dependencies).
 */

import { db } from "../db";
import { shops } from "../schema";
import { sql } from "drizzle-orm";

/**
 * Looks up a shop's email address by business name.
 * Uses case-insensitive matching with trimmed input.
 *
 * @param shopName - The shop name from the repair order (e.g., "FLORIDA AERO SYSTEMS")
 * @returns The shop's email address, or null if not found
 */
export async function getShopEmailByName(
  shopName: string | null | undefined
): Promise<string | null> {
  if (!shopName || shopName.trim() === "") {
    console.warn("[getShopEmailByName] Empty shop name provided");
    return null;
  }

  const trimmedName = shopName.trim();

  try {
    // Case-insensitive exact match first, then fuzzy match
    const result = await db
      .select({
        email: shops.email,
        businessName: shops.businessName,
      })
      .from(shops)
      .where(
        sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`
      )
      .limit(1);

    if (result.length > 0) {
      const email = result[0].email;
      if (email && email.trim() !== "") {
        return email.trim();
      }
      console.warn(
        `[getShopEmailByName] Shop "${trimmedName}" found but has no email address`
      );
      return null;
    }

    // Fallback: Try LIKE match for partial names
    const fuzzyResult = await db
      .select({
        email: shops.email,
        businessName: shops.businessName,
      })
      .from(shops)
      .where(
        sql`UPPER(TRIM(${shops.businessName})) LIKE UPPER(${`%${trimmedName}%`})`
      )
      .limit(1);

    if (fuzzyResult.length > 0) {
      const email = fuzzyResult[0].email;
      if (email && email.trim() !== "") {
        return email.trim();
      }
      console.warn(
        `[getShopEmailByName] Shop "${fuzzyResult[0].businessName}" found but has no email address`
      );
      return null;
    }

    console.warn(`[getShopEmailByName] No shop found matching "${trimmedName}"`);
    return null;
  } catch (error) {
    console.error(
      `[getShopEmailByName] Database error looking up shop "${trimmedName}":`,
      error
    );
    return null;
  }
}

/**
 * Gets full shop details by business name.
 * Useful for getting contact info, address, etc.
 */
export async function getShopByName(shopName: string | null | undefined) {
  if (!shopName || shopName.trim() === "") {
    return null;
  }

  const trimmedName = shopName.trim();

  try {
    const result = await db
      .select()
      .from(shops)
      .where(
        sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`
      )
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error(
      `[getShopByName] Database error looking up shop "${trimmedName}":`,
      error
    );
    return null;
  }
}

/**
 * Updates a shop's email address by business name.
 * Used when user edits email in approval dialog - saves for future use.
 *
 * @param shopName - The shop name to update (case-insensitive match)
 * @param newEmail - The new email address to save
 * @returns Result object with success status and optional error message
 */
export async function updateShopEmail(
  shopName: string | null | undefined,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  // Validate inputs
  if (!shopName || shopName.trim() === "") {
    return { success: false, error: "Shop name is required" };
  }

  if (!newEmail || newEmail.trim() === "") {
    return { success: false, error: "Email is required" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail.trim())) {
    return { success: false, error: "Invalid email format" };
  }

  const trimmedName = shopName.trim();
  const trimmedEmail = newEmail.trim();

  try {
    // First check if shop exists (for better error reporting)
    const existingShop = await db
      .select({ id: shops.id, businessName: shops.businessName })
      .from(shops)
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`)
      .limit(1);

    if (existingShop.length === 0) {
      console.warn(`[updateShopEmail] No shop found matching "${trimmedName}"`);
      return { success: false, error: "Shop not found" };
    }

    // Update shop email
    await db
      .update(shops)
      .set({ email: trimmedEmail })
      .where(sql`UPPER(TRIM(${shops.businessName})) = UPPER(${trimmedName})`);

    return { success: true };
  } catch (error) {
    console.error(
      `[updateShopEmail] Database error updating shop "${trimmedName}":`,
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}
