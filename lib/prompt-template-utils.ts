import type { PromptActionType, PromptAppliesTo, PromptScopeRequired, PromptTemplate } from "@/lib/types";

type TemplateDraft = {
  title: string;
  category: string;
  content: string;
  appliesTo: PromptAppliesTo;
  actionType: PromptActionType;
  scopeRequired: PromptScopeRequired;
  isDefault: boolean;
  isPinned: boolean;
  defaultN: number;
};

const emptyTemplateDraft: TemplateDraft = {
  title: "",
  category: "",
  content: "",
  appliesTo: "product",
  actionType: "generate",
  scopeRequired: "none",
  isDefault: false,
  isPinned: false,
  defaultN: 10
};

function templateToDraft(template: PromptTemplate): TemplateDraft {
  return {
    title: template.title,
    category: template.category,
    content: template.content,
    appliesTo: template.appliesTo,
    actionType: template.actionType,
    scopeRequired: template.scopeRequired,
    isDefault: template.isDefault,
    isPinned: template.isPinned,
    defaultN: template.defaultN
  };
}

function formatActionType(actionType: PromptActionType) {
  return actionType.charAt(0).toUpperCase() + actionType.slice(1);
}

async function parsePromptResponse(response: Response) {
  const payload = (await response.json()) as { activeTemplateId?: number; templates?: PromptTemplate[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not load prompt templates.");
  return payload;
}

export {
  emptyTemplateDraft,
  formatActionType,
  parsePromptResponse,
  templateToDraft,
  type TemplateDraft
};
