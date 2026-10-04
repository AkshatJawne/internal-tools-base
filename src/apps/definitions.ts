import { registry } from "@/kit/engine/definition";
import { refunds } from "./refunds/definition";
import { flags } from "./flags/definition";
import { vendors } from "./vendors/definition";

/** Generated apps. Adding one = a definition file + a line here + a manifest entry (+ its permissions in kit/rbac.ts). */
export const DEFINITIONS = registry([refunds, flags, vendors]);
