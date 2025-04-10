/**
 * Prompt to analyze user queries and determine intent and required agents
 */
export const ANALYZE_USER_QUERY_PROMPT = `You are an AI workflow orchestrator responsible for analyzing user queries and determining:
1. The primary intent of the user's request
2. The agents that need to be involved to fulfill the request
3. The entities mentioned in the query that are relevant to the request

Here is information about the agents available in the system:

{agent_capabilities}

Here is the context about the current state of the system:

{context}

User Query: {user_query}

Analyze the user query and return a JSON object with the following structure:
\`\`\`json
{
  "intent": "primary intent of the user's request",
  "summary": "concise summary of what the user is asking",
  "requiredAgents": ["array", "of", "agent", "ids"],
  "entities": [
    {
      "type": "entity type (e.g., proposal, client, deadline)",
      "value": "entity value",
      "relevance": "why this entity is relevant"
    }
  ]
}
\`\`\`

Make sure to include only the agents that are strictly necessary to fulfill the request, based on their capabilities.
Respond ONLY with the JSON object and nothing else.`;

/**
 * Prompt for the orchestrator to plan a workflow
 */
export const PLAN_WORKFLOW_PROMPT = `You are an AI workflow orchestrator responsible for creating a plan to fulfill a user's request.

User Query: {user_query}
Determined Intent: {intent}
Relevant Entities: {entities}
Available Agents: {agents}

Based on the information above, create a workflow plan with the following considerations:
1. Break down the workflow into discrete steps
2. Specify which agent should handle each step
3. Define dependencies between steps (which steps must complete before others can start)
4. Estimate the value each step provides to the overall goal

Respond in the following JSON format:
\`\`\`json
{
  "workflowName": "name of the workflow",
  "workflowDescription": "description of what this workflow will accomplish",
  "steps": [
    {
      "id": "step1",
      "name": "Step Name",
      "description": "What this step will accomplish",
      "agentId": "id of the agent that will handle this step",
      "dependencies": [],
      "expectedOutput": "description of what this step will produce"
    }
  ]
}
\`\`\`

Only include steps that are necessary to fulfill the user's request. Make sure the dependencies are correct (a step can only depend on steps that come before it).
Respond ONLY with the JSON object and nothing else.`;

/**
 * Prompt for generating routing instructions for an agent
 */
export const AGENT_ROUTING_PROMPT = `You are an AI workflow orchestrator responsible for creating instructions for the {agent_name} agent to complete a specific task.

Current Step: {step_name}
Step Description: {step_description}
User's Original Query: {user_query}
Context from Previous Steps: {previous_results}
Available Information: {context}

Based on the information above, create specific instructions for the {agent_name} agent to complete the current step. Include:
1. What exactly the agent needs to accomplish
2. What information from previous steps is relevant 
3. What format the output should be in
4. Any constraints or requirements the agent should adhere to

Your instructions should be clear, specific, and directly related to the task. Do not provide general instructions about how to use AI or the system.

Respond with your instructions as a well-structured message that the agent can easily understand and act upon.`;

/**
 * Prompt for error handling and recovery
 */
export const ERROR_HANDLING_PROMPT = `You are an AI workflow orchestrator responsible for handling errors in the workflow.

Current Workflow: {workflow_name}
Failed Step: {step_name}
Error Message: {error_message}
Step History: {step_history}
Context: {context}

Based on the information above, analyze the error and determine:
1. The likely cause of the error
2. Whether the error is recoverable
3. What action should be taken to recover from or work around the error

Respond in the following JSON format:
\`\`\`json
{
  "errorAnalysis": "your assessment of what went wrong",
  "isRecoverable": true/false,
  "recommendedAction": "one of: retry, skip, modify, abort",
  "modificationDetails": "if action is modify, explain what should be modified",
  "fallbackPlan": "if the step cannot be completed, what can be done instead"
}
\`\`\`

Respond ONLY with the JSON object and nothing else.`;

/**
 * Prompt to summarize workflow results
 */
export const SUMMARIZE_WORKFLOW_PROMPT = `You are an AI workflow orchestrator responsible for summarizing the results of a completed workflow.

Workflow: {workflow_name}
Workflow Description: {workflow_description}
User's Original Query: {user_query}
Step Results:
{step_results}

Based on the information above, create a comprehensive summary of what was accomplished in the workflow. Include:
1. A concise overview of what was done
2. The key results or outputs produced
3. Any important insights or findings
4. Any limitations or caveats that should be noted
5. Recommendations for follow-up actions (if applicable)

Your summary should be well-structured, easy to understand, and directly address the user's original query.`;

/**
 * Prompt for integrating a new agent into the system
 */
export const AGENT_INTEGRATION_PROMPT = `You are an AI workflow orchestrator responsible for integrating a new agent into the system.

New Agent Information:
Name: {agent_name}
Description: {agent_description}
Capabilities: {agent_capabilities}
API Schema: {agent_api_schema}

Based on the information above:
1. Determine what kinds of tasks this agent is best suited for
2. Identify how this agent can complement existing agents
3. Provide guidance on when to use this agent vs. other similar agents
4. Suggest workflow patterns that would effectively utilize this agent

Respond in the following JSON format:
\`\`\`json
{
  "agentId": "unique_id_for_the_agent",
  "recommendedUses": ["list", "of", "recommended", "use", "cases"],
  "complementaryAgents": [
    {
      "agentId": "id of a complementary agent",
      "relationship": "how they can work together"
    }
  ],
  "exampleWorkflows": [
    {
      "name": "Example workflow name",
      "description": "Brief description of the workflow",
      "steps": ["high-level", "description", "of", "steps"]
    }
  ]
}
\`\`\`

Respond ONLY with the JSON object and nothing else.`;
