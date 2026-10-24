/**
 * Tiny TSX/bash tokenizer for the docs. Deterministic, dependency-free, and
 * good enough for component snippets. Returns HTML with `tok-*` classes.
 */

const KEYWORDS = new Set([
  "import", "export", "from", "default", "const", "let", "var", "function", "return", "if", "else",
  "new", "async", "await", "type", "interface", "extends", "as", "true", "false", "null", "undefined",
  "class", "of", "in", "for", "while", "switch", "case", "break", "continue", "throw", "try", "catch",
]);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightTsx(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i]!;
    const rest = code.slice(i);
    // comments
    if (rest.startsWith("//")) {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += `<span class="tok-cm">${esc(code.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += `<span class="tok-cm">${esc(code.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }
    // strings
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === "\\") j++;
        j++;
      }
      out += `<span class="tok-str">${esc(code.slice(i, j + 1))}</span>`;
      i = j + 1;
      continue;
    }
    // JSX tags: <Name or </Name
    const tag = /^<\/?[A-Za-z][\w.]*/.exec(rest);
    if (tag) {
      const open = tag[0].startsWith("</") ? "&lt;/" : "&lt;";
      const name = tag[0].replace(/^<\/?/, "");
      out += `<span class="tok-pn">${open}</span><span class="tok-tag">${esc(name)}</span>`;
      i += tag[0].length;
      // attributes until > or />
      while (i < n) {
        const r2 = code.slice(i);
        const close = /^\s*\/?>/.exec(r2);
        if (close) {
          out += `<span class="tok-pn">${esc(close[0])}</span>`;
          i += close[0].length;
          break;
        }
        const ws = /^\s+/.exec(r2);
        if (ws) {
          out += ws[0];
          i += ws[0].length;
          continue;
        }
        const attr = /^[A-Za-z_$][\w$-]*/.exec(r2);
        if (attr) {
          out += `<span class="tok-attr">${esc(attr[0])}</span>`;
          i += attr[0].length;
          continue;
        }
        if (r2.startsWith("=")) {
          out += "=";
          i++;
          const r3 = code.slice(i);
          if (r3[0] === '"' || r3[0] === "'") {
            const q = r3[0];
            let j = i + 1;
            while (j < n && code[j] !== q) j++;
            out += `<span class="tok-str">${esc(code.slice(i, j + 1))}</span>`;
            i = j + 1;
          } else if (r3[0] === "{") {
            // balanced braces, highlighted recursively
            let depth = 0;
            let j = i;
            for (; j < n; j++) {
              if (code[j] === "{") depth++;
              else if (code[j] === "}") {
                depth--;
                if (depth === 0) break;
              }
            }
            out += `<span class="tok-pn">{</span>${highlightTsx(code.slice(i + 1, j))}<span class="tok-pn">}</span>`;
            i = j + 1;
          }
          continue;
        }
        // anything else inside a tag
        out += esc(code[i]!);
        i++;
      }
      continue;
    }
    // numbers
    const num = /^-?\d+(\.\d+)?/.exec(rest);
    if (num && !/[\w$]/.test(code[i - 1] ?? "")) {
      out += `<span class="tok-num">${num[0]}</span>`;
      i += num[0].length;
      continue;
    }
    // identifiers
    const id = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (id) {
      const word = id[0];
      const after = code.slice(i + word.length);
      if (KEYWORDS.has(word)) out += `<span class="tok-kw">${word}</span>`;
      else if (/^\s*\(/.test(after)) out += `<span class="tok-fn">${word}</span>`;
      else out += word;
      i += word.length;
      continue;
    }
    if ("{}()[]<>;,.=:+-*/!?&|".includes(ch)) {
      out += `<span class="tok-pn">${esc(ch)}</span>`;
      i++;
      continue;
    }
    out += esc(ch);
    i++;
  }
  return out;
}

export function highlightBash(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      if (line.startsWith("#")) return `<span class="tok-cm">${esc(line)}</span>`;
      const m = /^(\S+)(.*)$/.exec(line);
      if (!m) return esc(line);
      return `<span class="tok-fn">${esc(m[1]!)}</span>${esc(m[2]!).replace(/(--?[\w-]+)/g, '<span class="tok-attr">$1</span>').replace(/(https?:\/\/\S+|@\S+)/g, '<span class="tok-str">$1</span>')}`;
    })
    .join("\n");
}

export function highlight(code: string, lang: "tsx" | "bash" | "json" | "css" | "text"): string {
  switch (lang) {
    case "tsx":
    case "json":
    case "css":
      return highlightTsx(code);
    case "bash":
      return highlightBash(code);
    default:
      return esc(code);
  }
}
