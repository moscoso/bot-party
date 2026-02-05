/**
 * Extracts a specific value from a block of text based on a "KEY: VALUE" format.
 *
 * Uses a case-insensitive regex to locate the key and capture the rest of the line after the colon.
 *
 * @param key - The name of the key to search for (e.g., "TARGET", "GUESS", "VOTE").
 * @param text - The raw string to search within.
 * @returns The trimmed string value of the field if found; otherwise, an empty string.
 *
 * @example
 * const aiResponse = "I've decided.\nTARGET: Agent1\nQUESTION: What is the weather?";
 * const target = parseField("TARGET", aiResponse); // Returns "Agent1"
 */
export function parseField(key: string, text: string): string {
    const regex = new RegExp(`${key}:\\s*(.*)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}
