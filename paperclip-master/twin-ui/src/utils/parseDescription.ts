/**
 * Parse a Paperclip issue description (rich markdown) into structured
 * executive-readable sections for the minister's Decision Room.
 */

export interface ParsedSection {
  heading: string;
  text: string;     // clean prose, no markdown syntax
  items: string[];  // bullet/numbered list items
}

export interface ParsedDesc {
  title: string | null;      // top-level # heading
  summary: string;           // first substantive paragraph
  sections: ParsedSection[]; // ## sections
  ragAlerts: string[];       // lines with 🔴 🟡 🟢 🟠
  actions: string[];         // numbered action items
  metrics: string[];         // lines with quantitative data
}

function clean(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s+/, '')
    .trim();
}

const isTableLine  = (l: string) => l.startsWith('|');
const isListItem   = (l: string) => /^\s*[-*+]\s+|^\s*\d+\.\s+/.test(l);
const isBlank      = (l: string) => l.trim() === '';
const isHeading    = (l: string) => /^#{1,6}\s/.test(l);

export function parseDescription(raw: string | null | undefined): ParsedDesc {
  if (!raw) return { title: null, summary: '', sections: [], ragAlerts: [], actions: [], metrics: [] };

  const lines = raw.split('\n');

  // RAG traffic-light alerts
  const ragAlerts = lines
    .filter(l => /[🔴🟡🟢🟠]/.test(l))
    .map(clean)
    .filter(s => s.length > 5)
    .slice(0, 8);

  // Numbered action items (from numbered lists)
  const actions: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*\d+\.\s+(.+)/);
    if (m) {
      const txt = clean(m[1]);
      if (txt.length > 10 && !actions.includes(txt)) actions.push(txt);
    }
  }

  // Metric lines (percentages, large numbers, citizen counts)
  const metrics: string[] = [];
  for (const l of lines) {
    if (
      /\d+%|\d{1,3},\d{3}|\d+\s+(?:citizens|entities|ministries|weeks|days)/.test(l)
      && !isTableLine(l)
    ) {
      const txt = clean(l);
      if (txt.length > 10) metrics.push(txt);
    }
  }

  // Parse sections by ## headings
  let docTitle: string | null = null;
  const sections: ParsedSection[] = [];
  let heading = '';
  let cur: string[] = [];

  const flush = () => {
    const allBlank = cur.every(isBlank);
    if (!heading && allBlank) return;

    const items = cur.filter(isListItem).map(clean).filter(Boolean);
    const textLines = cur
      .filter(l => !isBlank(l) && !isTableLine(l) && !isListItem(l) && !isHeading(l))
      .map(clean)
      .filter(Boolean);
    const text = textLines.join(' ').trim();

    if (heading || text || items.length) {
      sections.push({ heading, text, items });
    }
    heading = '';
    cur = [];
  };

  for (const line of lines) {
    if (line.startsWith('# ') && !docTitle) {
      docTitle = clean(line);
    } else if (line.startsWith('## ')) {
      flush();
      heading = clean(line);
    } else {
      cur.push(line);
    }
  }
  flush();

  // Summary: first substantive non-heading line
  let summary = '';
  for (const l of lines) {
    if (isHeading(l) || isTableLine(l) || isBlank(l) || isListItem(l)) continue;
    const txt = clean(l);
    if (txt.length > 30) {
      summary = txt.slice(0, 320);
      break;
    }
  }
  if (!summary && sections[0]?.text) summary = sections[0].text.slice(0, 320);
  if (!summary && ragAlerts[0]) summary = ragAlerts[0].slice(0, 320);

  return {
    title: docTitle,
    summary,
    sections,
    ragAlerts,
    actions: actions.slice(0, 7),
    metrics: metrics.slice(0, 6),
  };
}
