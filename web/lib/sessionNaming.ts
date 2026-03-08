import { getOpenAIClient } from './openai';

/**
 * Generate a smart, descriptive session name from a user message.
 * Uses AI to create a concise summary of the user's intent.
 *
 * Examples:
 * - "Do we have any washers?" → "Search for washers"
 * - "Add 10 M4 bolts to the parts bin" → "Add M4 bolts to inventory"
 * - "Where did I put my drill bits?" → "Find drill bits location"
 * - "I need to organize my workbench tools" → "Organize workbench tools"
 */
export async function generateSessionName(userMessage: string): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You generate ultra-concise session names for an inventory management chat app. Given a user's first message, create a 2-5 word title that captures the intent/action. Use active verbs when possible. Output ONLY the title - no quotes, no punctuation at the end, no explanation.

Examples:
"Do we have any washers?" → Search for washers
"Add 10 M4 bolts to the parts bin" → Add M4 bolts
"Where did I put my drill bits?" → Find drill bits
"I need to organize my workbench tools" → Organize workbench
"Show me what's in drawer 3" → View drawer 3 contents
"Create a new storage module for electronics" → Create electronics module
"Delete the old screws from A1" → Delete screws from A1`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      // Clean up the response - remove any trailing punctuation and trim
      return content.trim().replace(/[.!?]+$/, '').replace(/^["']|["']$/g, '').slice(0, 60);
    }

    // Fallback if no response
    return truncateMessage(userMessage);
  } catch (error) {
    console.error('Failed to generate session name:', error);
    // Fallback to simple truncation
    return truncateMessage(userMessage);
  }
}

/**
 * Simple fallback: truncate message to create a name
 */
function truncateMessage(message: string): string {
  const cleaned = message.trim();
  if (cleaned.length <= 50) {
    return cleaned;
  }
  return cleaned.slice(0, 47) + '...';
}
