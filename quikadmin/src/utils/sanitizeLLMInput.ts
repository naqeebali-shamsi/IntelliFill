/**
 * Sanitizes user-provided text before interpolating into LLM prompts.
 * Prevents prompt injection attacks by removing dangerous patterns.
 *
 * @param input - Raw text from documents or user input
 * @param maxLength - Maximum allowed length (default: 50000 chars)
 * @returns Sanitized text safe for LLM prompt interpolation
 *
 * @example
 * // In multiagent workflow nodes:
 * const safeText = sanitizeLLMInput(document.extractedText);
 * const prompt = `Analyze this document:\n${safeText}`;
 */
export function sanitizeLLMInput(input: string, maxLength = 50000): string {
  if (!input || typeof input !== 'string') return '';

  return (
    input
      // Remove template injection patterns: {{...}}, {%...%}, ${...}
      .replace(/\{\{.*?\}\}/g, '')
      .replace(/\{%.*?%\}/g, '')
      .replace(/\$\{[^}]*\}/g, '')
      // Remove XML-style bracket injections: <system>, </system>, <user>, etc.
      .replace(/<\s*\/?\s*(system|user|assistant|prompt|instruction)\s*[^>]*\s*\/?>/gi, '')
      // Remove common prompt override phrases
      .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, '')
      .replace(/disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, '')
      .replace(/forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Enforce max length
      .slice(0, maxLength)
  );
}
