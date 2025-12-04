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
      console.log(
        `[getShopEmailByName] Fuzzy match: "${trimmedName}" → "${fuzzyResult[0].businessName}"`
      );
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
