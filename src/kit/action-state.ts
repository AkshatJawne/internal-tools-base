export type FormState = { ok?: string; error?: string } | null;

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
