// Concern: normalizes a host's hook payload into the canonical Event, its kind included | Non-concern: whether an Event is worth a reminder | IO: (host json) -> Event
/**
 * @typedef {'session-start' | 'prompt' | 'stop' | 'file-write' | 'display' | 'pre-tool' | 'other'} EventKind
 * @typedef {{
 *   kind: EventKind,
 *   sessionId: string,
 *   text: string,
 *   filePath: string | null,
 *   stopHookActive: boolean,
 *   messageId: string,
 *   delta: string,
 *   final: boolean,
 * }} Event
 */

/** Claude Code's tools that write a file's contents. */
const WRITE_TOOLS = new Set(['Write', 'Edit']);

/**
 * A Write carries `content`; an Edit carries the replacement it just applied.
 *
 * @param {Record<string, any>} raw
 */
const writtenText = (raw) => raw.tool_input?.content ?? raw.tool_input?.new_string ?? '';

/**
 * `PostToolUse` fires for every tool, so the write-vs-other decision is made here: no host's
 * tool names reach the core.
 *
 * @param {Record<string, any>} raw
 * @returns {EventKind}
 */
function classify(raw) {
  switch (raw.hook_event_name) {
    case 'SessionStart':
      return 'session-start';
    case 'UserPromptSubmit':
      return 'prompt';
    case 'Stop':
      return 'stop';
    case 'PostToolUse':
      return WRITE_TOOLS.has(raw.tool_name) ? 'file-write' : 'other';
    case 'MessageDisplay':
      return 'display';
    case 'PreToolUse':
      return 'pre-tool';
    default:
      throw new TypeError(`unknown hook_event_name: ${raw.hook_event_name}`);
  }
}

/**
 * @param {unknown} payload
 * @returns {Event}
 */
export function normalize(payload) {
  if (typeof payload !== 'object' || payload === null) {
    throw new TypeError('hook payload is not an object');
  }
  const raw = /** @type {Record<string, any>} */ (payload);
  const kind = classify(raw);

  return {
    kind,
    sessionId: raw.session_id ?? '',
    text:
      kind === 'stop'
        ? (raw.last_assistant_message ?? '')
        : kind === 'file-write'
          ? writtenText(raw)
          : (raw.prompt ?? ''),
    filePath: raw.tool_input?.file_path ?? null,
    stopHookActive: raw.stop_hook_active === true,
    messageId: raw.message_id ?? '',
    delta: raw.delta ?? '',
    final: raw.final === true,
  };
}
