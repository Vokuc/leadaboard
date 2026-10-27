import {
  AiActionProposal,
  AiAssistantContext,
  AiChatMessage,
  AiProposalStatus,
  AiTaskType,
  AiUsageLog,
} from '@/types';

export interface AiGenerateOptions {
  context: AiAssistantContext;
  prompt: string;
  history?: AiChatMessage[];
  taskType?: AiTaskType;
  actorUserId?: string;
}

export interface AiGenerateResult {
  content: string;
  proposal?: AiActionProposal;
  dataSources: string[];
  provider: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
  };
}

export interface AiProvider {
  name: string;
  isAvailable(): boolean;
  generateResponse(options: AiGenerateOptions): Promise<AiGenerateResult>;
  generateProposal(
    context: AiAssistantContext,
    taskType: AiTaskType,
    instructions?: string,
    actorUserId?: string
  ): Promise<AiActionProposal>;
}

export interface ProposalExecutionResult {
  success: boolean;
  message: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export {
  type AiActionProposal,
  type AiAssistantContext,
  type AiChatMessage,
  type AiProposalStatus,
  type AiTaskType,
  type AiUsageLog,
};
