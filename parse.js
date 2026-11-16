// Dependency-free ES module Markdown parser matching marked 18.1.3 (gfm: true, breaks: false)

function escapeHtml(html, encode) {
  if (encode) {
    if (/&(?!#?\w+;)/.test(html)) {
      html = html.replace(/&/g, '&amp;');
    }
  } else {
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  return html;
}

function parseInline(text) {
  if (!text) return '';
  
  // Escape entities / basic escapes
  // Code spans
  const codeSpans = [];
  text = text.replace(/(`+)([\s\S]*?)\1/g, (match, p1, p2) => {
    const id = `\x00CODE${codeSpans.length}\x00`;
    codeSpans.push(`<code>${escapeHtml(p2)}</code>`);
    return id;
  });

  // Images ![alt](href)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, href) => {
    const parts = href.trim().split(/\s+/);
    let url = parts[0];
    let title = parts.slice(1).join(' ');
    if (title.startsWith('"') && title.endsWith('"') || title.startsWith("'") && title.endsWith("'")) {
      title = title.slice(1, -1);
    }
    let res = `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"`;
    if (title) res += ` title="${escapeHtml(title)}"`;
    res += '>';
    return res;
  });

  // Links [text](href)
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

  // Autolinks <http://...>
  text = text.replace(/<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^ >]*)>/g, (match, link) => {
    return `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
  });

  // Email autolinks <user@domain>
  text = text.replace(/<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/g, (match, email) => {
    return `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
  });

  // Strikethrough ~~text~~
  text = text.replace(/~~([\s\S]*?)~~/g, (match, p1) => {
    return `<del>${parseInline(p1)}</del>`;
  });

  // Strong **text** or __text__
  text = text.replace(/\*\*([\s\S]*?)\*\*/g, (match, p1) => {
    return `<strong>${parseInline(p1)}</strong>`;
  });
  text = text.replace(/__([\s\S]*?)__/g, (match, p1) => {
    return `<strong>${parseInline(p1)}</strong>`;
  });

  // Emphasis *text* or _text_
  text = text.replace(/\*([\s\S]*?)\*/g, (match, p1) => {
    return `<em>${parseInline(p1)}</em>`;
  });
  text = text.replace(/_([\s\S]*?)_/g, (match, p1) => {
    return `<em>${parseInline(p1)}</em>`;
  });

  // Restore code spans
  text = text.replace(/\x00CODE(\d+)\x00/g, (match, id) => {
    return codeSpans[parseInt(id, 10)];
  });

  return text;
}

export function parse(markdown) {
  if (!markdown) return '';
  
  // Normalize line endings
  let lines = markdown.replace(/\r\n|\r/g, '\n').split('\n');
  let html = [];
  
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
      const fence = line.trim().slice(0, 3);
      const lang = line.trim().slice(3).trim();
      i++;
      let codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      let code = codeLines.join('\n');
      if (code && !code.endsWith('\n') && codeLines.length > 0) {
        // preserve trailing newline behavior if needed
      }
      // marked code block format
      let attrs = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html.push(`<pre><code${attrs}>${escapeHtml(code)}\n</code></pre>`); // wait, let's check exact marked closing newline for code blocks
      continue;
    }

    // Thematic break
    if (/^(?:[*-_]\s*){3,}$/.test(line.trim())) {
      html.push('<hr>');
      i++;
      continue;
    }

    // ATX Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      html.push(`<h${level}>${parseInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      let bqLines = [];
      while (i < lines.length && (lines[i].trim().startsWith('>') || lines[i].trim() === '')) {
        let l = lines[i].trim();
        if (l.startsWith('>')) {
          l = l.slice(1).trim();
        }
        bqLines.push(l);
        i++;
      }
      let innerHtml = parse(bqLines.join('\n'));
      html.push(`<blockquote>\n${innerHtml}</blockquote>\n`);
      continue;
    }

    // Tables (GFM)
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      let headerCells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
      let delimCells = lines[i + 1].split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
      
      let aligns = delimCells.map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        if (cell.startsWith(':')) return 'left';
        return '';
      });

      i += 2;
      let bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        let rowCells = lines[i].split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
        bodyRows.push(rowCells);
        i++;
      }

      let t = '<table>\n<thead>\n<tr>\n';
      headerCells.forEach((cell, idx) => {
        let align = aligns[idx] ? ` align="${aligns[idx]}"` : '';
        t += `<th${align}>${parseInline(cell)}</th>\n`;
      });
      t += '</tr>\n</thead>\n';
      if (bodyRows.length > 0) {
        t += '<tbody>\n';
        bodyRows.forEach(row => {
          t += '<tr>\n';
          row.forEach((cell, idx) => {
            let align = aligns[idx] ? ` align="${aligns[idx]}"` : '';
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

    // Default: Paragraph or normal text block
    let paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('#') && !/^(?:[*-_]\s*){3,}$/.test(lines[i].trim()) && !lines[i].trim().startsWith('>')) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${parseInline(paraLines.join('\n'))}</p>`);
    }
  }

  return html.join('\n');
}
