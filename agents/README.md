# Agent Definitions

Reusable prompt templates for the different roles in the maintenance system. Each agent type has a specific responsibility and operating procedure.

## How to Use

Open a Claude Code session in the `odd-team` directory and say:
"Act as {agent type}. Your task: {specific instruction}."

The agent prompt files below define the operating procedures each role follows.

## Agent Types

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| Scanner | Run an audit scan | Scanner definition file | Findings + navigation updates |
| Triager | Convert findings to work items | Findings files | Backlog items + file registry updates |
| Implementer | Execute a work item | Work item file | Code changes + status update |
| Reviewer | Verify completed work | Done work item | Acceptance or rejection |

## Session Protocol (All Agents)

1. Read `CLAUDE.md` first (system orientation)
2. Read `navigation/features.yaml` (know the landscape)
3. Read the specific domain file(s) relevant to your task
4. Execute your role-specific procedure
5. Update navigation if you discover new file locations
6. Update `state/PROGRESS.md` if status changes

## Token Budget

Each session should:
- Spend <10% of tokens on orientation (steps 1-3)
- Spend >80% on productive work (step 4)
- Spend <10% on bookkeeping (steps 5-6)

If orientation exceeds 10%, the navigation index needs improvement for that domain.
