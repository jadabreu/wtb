import { z } from "zod";
import { idealStateLabelValues } from "@/lib/types";

const fieldKeyValues = ["product", "end_user", "context", "job", "emotional_job", "social_job", "complexity_factors"] as const;
const listFieldKeyValues = ["emotional_job", "social_job", "complexity_factors"] as const;

const optionSchema = z.object({
  key: z.enum(fieldKeyValues),
  value: z.string().min(1),
  rationale: z.string()
});

const generatedJobStepSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  success_metrics: z.array(z.string().min(1)).max(20)
});

const generatedIdealStateSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  label: z.enum(idealStateLabelValues),
  blockers: z.array(z.string().min(1)).max(20)
});

const suggestionReplySchema = z.object({
  message: z.string().min(1),
  suggestions: z.array(optionSchema).max(4),
  options: z.array(optionSchema).max(100),
  job_steps: z.array(generatedJobStepSchema).max(20),
  ideal_states: z.array(generatedIdealStateSchema).max(20)
});

const agentIdealDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  label: z.enum(idealStateLabelValues),
  blockers: z.array(z.string()).max(20)
});

const agentJobStepDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  success_metrics: z.array(z.string()).max(20)
});

const agentThemeDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  color: z.string().nullable()
});

const agentIdealThemeAssignmentSchema = z.object({
  ideal_id: z.number().int().positive(),
  theme_titles: z.array(z.string()).max(8)
});

const agentMetricThemeAssignmentSchema = z.object({
  job_step_id: z.number().int().positive(),
  metric_id: z.number().int().positive(),
  theme_titles: z.array(z.string()).max(8)
});

const agentEditCandidateSchema = z.object({
  type: z.enum([
    "set_field",
    "append_list_field",
    "replace_job_map",
    "append_job_step",
    "update_job_step",
    "delete_job_step",
    "replace_success_metrics",
    "append_success_metrics",
    "replace_ideal",
    "append_ideal",
    "split_ideal",
    "update_ideal_label",
    "replace_ideal_blockers",
    "append_ideal_blockers",
    "organize_themes",
    "delete_ideal"
  ]),
  field_key: z.enum(fieldKeyValues).nullable(),
  list_field_key: z.enum(listFieldKeyValues).nullable(),
  value: z.string().nullable(),
  values: z.array(z.string()).max(50),
  job_step_id: z.number().int().positive().nullable(),
  job_step: agentJobStepDraftSchema.nullable(),
  job_steps: z.array(agentJobStepDraftSchema).max(20),
  metrics: z.array(z.string()).max(20),
  ideal_id: z.number().int().positive().nullable(),
  ideal: agentIdealDraftSchema.nullable(),
  ideals: z.array(agentIdealDraftSchema).max(10),
  label: z.enum(idealStateLabelValues).nullable(),
  blockers: z.array(z.string()).max(20),
  themes: z.array(agentThemeDraftSchema).max(30),
  ideal_theme_assignments: z.array(agentIdealThemeAssignmentSchema).max(50),
  metric_theme_assignments: z.array(agentMetricThemeAssignmentSchema).max(80),
  theme_assignment_mode: z.enum(["append", "replace"]).nullable(),
  summary: z.string()
});

const agentReplySchema = z.object({
  message: z.string().min(1),
  edit_set: z
    .object({
      summary: z.string(),
      patches: z.array(agentEditCandidateSchema).max(50)
    })
    .nullable()
});

const editArtifactsParameters = z.object({
  summary: z.string().min(1),
  operations: z.array(agentEditCandidateSchema).min(1).max(50)
});

const optionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "value", "rationale"],
  properties: {
    key: {
      type: "string",
      enum: [...fieldKeyValues]
    },
    value: {
      type: "string",
      description: "A concrete candidate value the user can accept."
    },
    rationale: {
      type: "string",
      description: "A short reason this option fits the conversation."
    }
  }
} as const;

const suggestionResponseFormatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "suggestions", "options", "job_steps", "ideal_states"],
  properties: {
    message: {
      type: "string",
      description: "A concise framing reply. Ask at most one follow-up question."
    },
    suggestions: {
      type: "array",
      maxItems: 4,
      description: "The best quick-save field values to show as primary recommendation chips.",
      items: optionResponseSchema
    },
    options: {
      type: "array",
      maxItems: 100,
      description: "Every generated field-like option or candidate, including all requested N candidates when they map to the target field.",
      items: optionResponseSchema
    },
    job_steps: {
      type: "array",
      maxItems: 20,
      description: "Always return an empty array for field suggestion generation.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "success_metrics"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          success_metrics: {
            type: "array",
            maxItems: 20,
            items: { type: "string" }
          }
        }
      }
    },
    ideal_states: {
      type: "array",
      maxItems: 20,
      description: "Always return an empty array for field suggestion generation.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "label", "blockers"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          label: {
            type: "string",
            enum: [...idealStateLabelValues]
          },
          blockers: {
            type: "array",
            maxItems: 20,
            items: { type: "string" }
          }
        }
      }
    }
  }
} as const;

export {
  agentIdealDraftSchema,
  agentEditCandidateSchema,
  agentJobStepDraftSchema,
  agentThemeDraftSchema,
  agentReplySchema,
  editArtifactsParameters,
  fieldKeyValues,
  listFieldKeyValues,
  optionSchema,
  suggestionReplySchema,
  suggestionResponseFormatSchema
};
