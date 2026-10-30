import { v } from "convex/values";
import schema from "../schema";

export const accountStatusSchema = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("closed"),
);

export const accountDocumentSchema = schema.doc("accounts");
