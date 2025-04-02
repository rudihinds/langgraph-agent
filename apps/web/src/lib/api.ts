/**
 * API client for interacting with LangGraph agents
 */

// Constants for API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:2024';

/**
 * Send a message to the proposal agent
 * @param message The user message to send
 * @param assistantId The ID of the assistant/graph to use
 * @param apiKey Optional API key for authentication
 * @returns Response from the agent
 */
export async function sendMessage(message: string, assistantId: string, apiKey?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // For LangGraph Cloud, use the standard run endpoint
  const endpoint = `${API_BASE_URL}/agents/${assistantId}/runs`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: {
          messages: [
            {
              type: 'human',
              content: message,
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Check if the LangGraph server is available
 * @param serverUrl The URL of the LangGraph server
 * @returns True if the server is available
 */
export async function checkServerAvailability(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error checking server availability:', error);
    return false;
  }
}

/**
 * Get a list of available agents from the LangGraph server
 * @param serverUrl The URL of the LangGraph server
 * @param apiKey Optional API key for authentication
 * @returns Array of available agent IDs
 */
export async function getAvailableAgents(serverUrl: string, apiKey?: string): Promise<string[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  try {
    const response = await fetch(`${serverUrl}/agents`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.agents || [];
  } catch (error) {
    console.error('Error getting available agents:', error);
    return [];
  }
}