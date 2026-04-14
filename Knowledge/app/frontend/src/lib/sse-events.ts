export type ParsedSseEvent = {
  eventType: string;
  data: any;
};

export function parseSseEvent(rawEvent: string): ParsedSseEvent | null {
  if (!rawEvent.trim()) return null;

  let eventType = 'message';
  const dataLines: string[] = [];

  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.substring(5).trim());
    }
  }

  const dataStr = dataLines.join('\n').trim();
  if (!dataStr) return null;

  try {
    return {
      eventType,
      data: JSON.parse(dataStr),
    };
  } catch {
    return null;
  }
}
