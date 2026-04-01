import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS (Still kept for type generation, but no longer used for DB) ===
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: jsonb("content").notNull(), // Stores the entire NetworkState
  createdAt: timestamp("created_at").defaultNow(),
});

// === BASE SCHEMAS ===
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });

// === APPLICATION TYPES (Network Elements) ===

// Node Types
export const nodeTypeSchema = z.enum(["reservoir", "node", "junction", "surgeTank", "flowBoundary", "pump", "checkValve"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

// Element Properties Schemas
export const reservoirPropsSchema = z.object({
  id: z.string(),
  elevation: z.number(),
  mode: z.enum(["fixed", "schedule"]).default("fixed"),
  reservoirElevation: z.number().default(0),
  hScheduleNumber: z.number().optional(),
  comment: z.string().optional(),
});

export const nodePropsSchema = z.object({
  nodeNumber: z.number().int(),
  elevation: z.number(),
  comment: z.string().optional(),
});

export const junctionPropsSchema = z.object({
  nodeNumber: z.number().int(),
  elevation: z.number(),
  comment: z.string().optional(),
});

export const surgeTankTypeSchema = z.enum(["SIMPLE", "DIFFERENTIAL", "AIRTANK"]);
export type SurgeTankType = z.infer<typeof surgeTankTypeSchema>;

export const surgeTankPropsSchema = z.object({
  id: z.string(),
  nodeNumber: z.number().int(),
  type: surgeTankTypeSchema.default("SIMPLE"),
  tankTop: z.number(),
  tankBottom: z.number(),
  diameter: z.number().optional(),
  initialWaterLevel: z.number().optional(), // HTANK
  riserDiameter: z.number().optional(),     // RISERDIAM
  riserTop: z.number().optional(),          // RISERTOP
  celerity: z.number().default(0),
  friction: z.number().default(0),
  hasAddedLoss: z.boolean().default(false),
  cplus: z.number().optional(),
  cminus: z.number().optional(),
  hasShape: z.boolean().default(false),
  shape: z.array(z.object({
    e: z.number(),
    a: z.number()
  })).optional(),
  comment: z.string().optional(),
});

export const flowBoundaryPropsSchema = z.object({
  id: z.string(),
  nodeNumber: z.number().int(),
  scheduleNumber: z.number().int(),
  schedulePoints: z.array(z.object({
    time: z.number(),
    flow: z.number()
  })).optional(),
  comment: z.string().optional(),
});

// Link/Conduit Types
export const linkTypeSchema = z.enum(["conduit", "dummy"]);
export type LinkType = z.infer<typeof linkTypeSchema>;

export const conduitPropsSchema = z.object({
  id: z.string(),
  fromNode: z.number().int(), // Node Number
  toNode: z.number().int(),   // Node Number
  length: z.number(),
  diameter: z.number(),
  celerity: z.number(),
  friction: z.number(),
  numSegments: z.number().int().default(1),
  cplus: z.number().optional(),
  cminus: z.number().optional(),
  comment: z.string().optional(),
  // VARIABLE section
  variable: z.boolean().optional(),
  distance: z.number().optional(),
  area: z.number().optional(),
  d: z.number().optional(),
  a: z.number().optional(),
});

export const dummyPipePropsSchema = z.object({
  id: z.string(),
  fromNode: z.number().int(),
  toNode: z.number().int(),
  diameter: z.number(),
  cplus: z.number().optional(),
  cminus: z.number().optional(),
  comment: z.string().optional(),
});

export const hScheduleSchema = z.object({
  number: z.number().int(),
  points: z.array(z.object({
    time: z.number(),
    head: z.number()
  }))
});

// Network State Structure (matches the spec's JSON structure)
export const networkStateSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(), // React Flow ID
    type: nodeTypeSchema,
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.any(), // Holds the specific properties based on type
  })),
  edges: z.array(z.object({
    id: z.string(), // React Flow ID
    type: linkTypeSchema,
    source: z.string(),
    target: z.string(),
    data: z.any(), // Holds the specific properties based on type
  })),
  hSchedules: z.array(hScheduleSchema).default([]),
});

export type NetworkState = z.infer<typeof networkStateSchema>;

// === API CONTRACT TYPES ===
export type Project = {
  id: number;
  name: string;
  content: any;
  createdAt: Date | null;
};
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type CreateProjectRequest = InsertProject;
export type UpdateProjectRequest = Partial<InsertProject>;

export type ProjectResponse = Project;
export type ProjectListResponse = Project[];
