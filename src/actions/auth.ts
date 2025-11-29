"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

/**
 * Sign in with Microsoft Entra ID
 * @param redirectTo - Optional redirect path after sign-in
 */
export async function signInAction(redirectTo?: string) {
  try {
    await signIn("microsoft-entra-id", {
      redirectTo: redirectTo ?? "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid credentials" };
        case "AccessDenied":
          return { success: false, error: "Access denied" };
        case "OAuthSignInError":
          return { success: false, error: "OAuth sign-in failed" };
        default:
          return { success: false, error: "An error occurred during sign-in" };
      }
    }
    // Re-throw redirect errors (these are expected)
    throw error;
  }
}

/**
 * Sign out the current user
 * @param redirectTo - Optional redirect path after sign-out
 */
export async function signOutAction(redirectTo?: string) {
  try {
    await signOut({
      redirectTo: redirectTo ?? "/",
    });
  } catch (error) {
    // Re-throw redirect errors (these are expected)
    throw error;
  }
}
