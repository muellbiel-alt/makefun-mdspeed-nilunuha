// Optimized dependency-free ES module Markdown parser matching marked 18.1.3 (gfm: true, breaks: false)

const ESCAPE_TEST = /[&<>"']/;
const ESCAPE_REPLACE = new RegExp(ESCAPE_TEST.source, 'g');
const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(html) {
  if (!ESCAPE_TEST.test(html)) return html;
  return html.replace(ESCAPE_REPLACE, ch => ESCAPES[ch]);
}

function parseInline(text) {
  if (!text) return '';
  
  const codeSpans = [];
  text = text.replace(/(`+)([\s\S]*?)\1/g, (match, p1, p2) => {
    const id = `\x00C${codeSpans.length}\x00`;
    codeSpans.push(`<code>${escapeHtml(p2)}</code>`);
    return id;
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, href) => {
    const parts = href.trim().split(/\s+/);
    let url = parts[0];
    let title = parts.slice(1).join(' ');
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
      title = title.slice(1, -1);
    }
    let res = `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"`;
    if (title) res += ` title="${escapeHtml(title)}"`;
    res += '>';
    return res;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    const parts = href.trim().split(/\s+/);
    let url = parts[0];
    let title = parts.slice(1).join(' ');
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
      title = title.slice(1, -1);
    }
    const inner = parseInline(label);
    let res = `<a href="${escapeHtml(url)}"`;
    if (title) res += ` title="${escapeHtml(title)}"`;
    res += `>${inner}</a>`;
    return res;
  });

  text = text.replace(/<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^ >]*)>/g, (match, link) => {
    return `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
  });

  text = text.replace(/<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/g, (match, email) => {
    return `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
  });

  text = text.replace(/~~([\s\S]*?)~~/g, (match, p1) => {
    return `<del>${parseInline(p1)}</del>`;
  });

  text = text.replace(/\*\*([\s\S]*?)\*\*/g, (match, p1) => {
    return `<strong>${parseInline(p1)}</strong>`;
  });
  text = text.replace(/__([\s\S]*?)__/g, (match, p1) => {
    return `<strong>${parseInline(p1)}</strong>`;
  });

  text = text.replace(/\*([\s\S]*?)\*/g, (match, p1) => {
    return `<em>${parseInline(p1)}</em>`;
  });
  text = text.replace(/_([\s\S]*?)_/g, (match, p1) => {
    return `<em>${parseInline(p1)}</em>`;
  });

  text = text.replace(/\x00C(\d+)\x00/g, (match, id) => {
    return codeSpans[parseInt(id, 10)];
  });

  return text;
}

const isHeading = (line) => /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.test(line);

export function parse(markdown) {
  if (!markdown) return '';
  
  const lines = markdown.replace(/\r\n|\r/g, '\n').split('\n');
  const html = [];
  
  let i = 0;
  const len = lines.length;
  while (i < len) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.slice(0, 3);
      const lang = trimmed.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < len && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < len) i++;
      const code = codeLines.join('\n');
      const attrs = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html.push(`<pre><code${attrs}>${escapeHtml(code)}\n</code></pre>`);
      continue;
    }

    if (/^(?:[*-_]\s*){3,}$/.test(trimmed)) {
      html.push('<hr>');
      i++;
      continue;
    }

    // ATX Headings (1 to 6 hashes)
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      html.push(`<h${level}>${parseInline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const bqLines = [];
      while (i < len) {
        const l = lines[i].trim();
        if (l.startsWith('>')) {
          bqLines.push(l.slice(1).trim());
          i++;
        } else if (l === '') {
          bqLines.push('');
          i++;
        } else {
          break;
        }
      }
      const innerHtml = parse(bqLines.join('\n'));
      html.push(`<blockquote>\n${innerHtml}</blockquote>\n`);
      continue;
    }

    if (line.includes('|') && i + 1 < len && /^[\s|:-]+$/.test(lines[i + 1])) {
      const parseCells = (str) => {
        let parts = str.split('|');
        if (parts[0].trim() === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
        return parts.map(c => c.trim());
      };

      const headerCells = parseCells(line);
      const delimCells = parseCells(lines[i + 1]);
      
      const aligns = delimCells.map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        if (cell.startsWith(':')) return 'left';
        return '';
      });

      i += 2;
      const bodyRows = [];
      while (i < len && lines[i].includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parseCells(lines[i]));
        i++;
      }

      let t = '<table>\n<thead>\n<tr>\n';
      headerCells.forEach((cell, idx) => {
        const align = aligns[idx] ? ` align="${aligns[idx]}"` : '';
        t += `<th${align}>${parseInline(cell)}</th>\n`;
      });
      t += '</tr>\n</thead>\n';
      if (bodyRows.length > 0) {
        t += '<tbody>\n';
        bodyRows.forEach(row => {
          t += '<tr>\n';
          row.forEach((cell, idx) => {
            const align = aligns[idx] ? ` align="${aligns[idx]}"` : '';
            t += `<td${align}>${parseInline(cell)}</td>\n`;
          });
          t += '</tr>\n';
        });
        t += '</tbody>\n';
      }
      t += '</table>\n';
      html.push(t);
      continue;
    }

    // Default: Paragraph
    const paraLines = [];
    while (i < len) {
      const l = lines[i];
      const lt = l.trim();
      if (lt === '' || isHeading(l) || /^(?:[*-_]\s*){3,}$/.test(lt) || lt.startsWith('>')) {
        break;
      }
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${parseInline(paraLines.join('\n'))}</p>`);
    }
  }

  return html.join('\n');
}
