# ADR-0004: Grounded AI Competition Assistant with Structured Proposal Execution

## Status
Accepted

## Context
Organizers frequently need assistance understanding complex tie-breakers, generating balanced round-robin schedules, summarizing matchday outcomes, or drafting participant announcements. While Large Language Models (LLMs) can generate text fluently, giving an LLM direct unverified write permissions to database tables creates severe risk of hallucinated scores, corrupted tournament seeds, or accidental destructive deletions.

## Decision
We implemented a **Grounded Co-Pilot Architecture with Two-Phase Structured Proposals**:

1. **Read-Only Context Grounding**: The [AiContextBuilder](file:///c:/Users/DELL/Documents/leaderboard/src/lib/ai/context.ts) compiles verified competition state (current standings, rules, upcoming fixtures, registration counts, recent results) into a deterministic context snapshot before any LLM prompt is executed. The assistant is instructed never to fabricate competition data.
2. **Two-Phase Action Proposals**:
   - The AI assistant cannot execute direct database mutations.
   - When an action is requested (e.g., schedule generation, rule updates, matchday announcements), the AI generates a strictly typed JSON proposal conforming to [ProposalPayloadSchema](file:///c:/Users/DELL/Documents/leaderboard/src/lib/ai/proposals/schemas.ts) and stored in `ai_competition_proposals`.
   - The organizer reviews a human-readable diff in [AiAssistantPanel](file:///c:/Users/DELL/Documents/leaderboard/src/components/ai/AiAssistantPanel.tsx) with explicit "Accept & Apply" or "Reject" buttons.
   - Upon explicit acceptance, [AiProposalExecutor](file:///c:/Users/DELL/Documents/leaderboard/src/lib/ai/proposals/executor.ts) validates permissions and executes the action through existing domain services (`SchedulingService`, `RulesService`, etc.), guaranteeing full audit logging.
3. **Provider Fallback & Rate Limiting**: Managed through [src/lib/ai/service.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/ai/service.ts) supporting Google Gemini (`gemini-1.5-flash`), OpenAI, or an offline heuristic fallback (`GroundedLocalProvider`), complete with token bucket rate limiting.

## Alternatives Considered
- **Direct LLM Tool-Calling with Auto-Execution**: High risk of unintended mutations or silent errors during high-stakes tournament operations.
- **External Unconnected Chatbot**: Lacks real-time competition context, forcing organizers to manually copy-paste standings and schedule state.

## Consequences
### Positive
- Zero risk of unreviewed mutations or corrupted tournament states.
- Works offline or without external API keys using deterministic local grounding rules.
- Complete auditability: all proposed actions and executor events are recorded in `ai_competition_proposals`.

### Negative / Trade-offs
- Requires two user clicks (propose, then review & confirm) rather than fully autonomous execution.
- LLM output schemas must be kept synchronized with domain validation models.
