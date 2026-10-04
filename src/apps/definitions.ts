import type { AppDefinition } from "@/kit/engine/types";
import { refunds } from "./refunds/definition";
import { flags } from "./flags/definition";

// Generated apps. Adding one = a definition file + an entry here + a manifest entry.
export const DEFINITIONS: Record<string, AppDefinition> = { refunds, flags };
