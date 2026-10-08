/* DataFlow Lite: CSV parsing, validation and safe export (local only). */
(function (root) {
  "use strict";

  const MAX_CENTS = 99999999999;

  function detectDelimiter(input) {
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === '"') {
        if (quoted && input[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && (char === "\n" || char === "\r")) {
        break;
      } else if (!quoted && Object.hasOwn(counts, char)) {
        counts[char]++;
      }
    }
    const order = [";", ",", "\t"];
    order.sort((a, b) => counts[b] - counts[a]);
    if (!counts[order[0]]) throw new Error("No se detectó un separador CSV (; , o tabulación).");
    return order[0];
  }

  // Returns physical start-line numbers, including quoted multiline fields.
  function parseRecords(content) {
    if (typeof content !== "string") throw new TypeError("El CSV debe ser texto.");
    const input = content.replace(/^\uFEFF/, "");
    if (!input.trim()) return [];

    const delimiter = detectDelimiter(input);
    const records = [];
    let line = 1, startLine = 1, field = "", cells = [];
    let quoted = false, afterQuote = false;

    function pushRecord() {
      cells.push(field);
      records.push({ cells, line: startLine });
      cells = [];
      field = "";
      afterQuote = false;
    }

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const newline = char === "\r" || char === "\n";
      if (quoted) {
        if (char === '"') {
          if (input[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; afterQuote = true; }
        } else if (newline) {
          if (char === "\r" && input[i + 1] === "\n") i++;
          field += "\n";
          line++;
        } else {
          field += char;
        }
        continue;
      }

      if (char === delimiter) {
        cells.push(field);
        field = "";
        afterQuote = false;
      } else if (newline) {
        pushRecord();
        if (char === "\r" && input[i + 1] === "\n") i++;
        line++;
        startLine = line;
      } else if (char === '"') {
        if (field || afterQuote) throw new Error("Comillas fuera de lugar en línea " + line + ".");
        quoted = true;
      } else if (afterQuote) {
        throw new Error("Caracteres después de cerrar comillas en línea " + line + ".");
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error("CSV incorrecto: hay comillas sin cerrar.");
    if (field || cells.length || afterQuote) pushRecord();

    const header = records[0];
    for (const record of records.slice(1)) {
      // Empty physical lines are ignored, not treated as malformed data rows.
      if (record.cells.length === 1 && !record.cells[0].trim()) continue;
      if (record.cells.length !== header.cells.length) {
        throw new Error("La línea " + record.line + " tiene " + record.cells.length +
          " columnas; se esperaban " + header.cells.length + ".");
      }
    }
    return records;
  }

  function parse(content) {
    return parseRecords(content).map(record => record.cells);
  }

  // Non-localized prototype policy: no grouping separators, maximum 2 decimals.
  function parsePrice(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim());
    if (!match) return null;
    const cents = Number(match[1]) * 100 +
      Number((match[2] || "").padEnd(2, "0"));
    return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents / 100 : null;
  }

  const normalizeSku = value => value.trim().toLowerCase();
  const normalizeName = value => value.trim().toLowerCase();

  function validateRecords(records, indices, options = {}) {
    if (!Array.isArray(indices) || indices.length !== 3 ||
        indices.some(index => !Number.isSafeInteger(index) || index < 0) ||
        new Set(indices).size !== 3) {
      throw new Error("Selecciona tres columnas diferentes.");
    }
    const [skuIndex, nameIndex, priceIndex] = indices;
    const rows = records.filter(record => record.cells.some(cell => cell.trim() !== ""))
      .map(record => {
        if (Math.max(...indices) >= record.cells.length) {
          throw new Error("El mapeo no coincide con el número de columnas.");
        }
        const sku = record.cells[skuIndex].trim();
        const name = record.cells[nameIndex].trim();
        const rawPrice = record.cells[priceIndex].trim();
        const price = parsePrice(rawPrice);
        const errors = [];
        if (!sku) errors.push("SKU vacío");
        if (!name) errors.push("Nombre vacío");
        if (price === null) errors.push("Precio inválido (usa 0-2 decimales, sin miles)");
        return { line: record.line, sku, name, rawPrice, price, errors, warnings: [] };
      });

    const groups = new Map();
    for (const row of rows) {
      if (!row.sku) continue;
      const key = normalizeSku(row.sku);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    // Default: reject every occurrence of a repeated SKU.
    // Optional mode: allow unique name/price variants under the same SKU;
    // identical duplicates remain invalid, and field errors are never bypassed.
    const allowDistinctSku = options != null && options.allowDistinctSku === true;
    for (const group of groups.values()) {
      if (group.length === 1) continue;
      const lines = group.map(row => row.line).join(", ");
      if (!allowDistinctSku) {
        const prices = [...new Set(group
          .filter(row => row.price !== null)
          .map(row => row.price.toFixed(2)))];
        const names = new Set(group.map(row => normalizeName(row.name)));
        let message = "SKU repetido en líneas " + lines;
        if (prices.length > 1) message += "; precios diferentes: " + prices.join(" / ");
        if (names.size > 1) message += "; nombres diferentes";
        if (prices.length <= 1 && names.size === 1) message += "; datos repetidos";
        group.forEach(row => row.errors.push(message));
        continue;
      }

      const signatures = new Map();
      for (const row of group) {
        if (!row.name || row.price === null) continue;
        const signature = JSON.stringify([normalizeName(row.name), row.price.toFixed(2)]);
        if (!signatures.has(signature)) signatures.set(signature, []);
        signatures.get(signature).push(row);
      }
      for (const equalRows of signatures.values()) {
        if (equalRows.length <= 1) continue;
        const equalLines = equalRows.map(row => row.line).join(", ");
        const message = "Registro duplicado (mismo SKU, nombre y precio) en líneas " + equalLines;
        equalRows.forEach(row => row.errors.push(message));
      }

      for (const row of group) {
        if (row.errors.length === 0) {
          row.warnings.push("SKU repetido permitido por configuración (líneas " + lines +
            "). Confirma que el sistema destino admita identificadores repetidos.");
        }
      }
    }
    return rows;
  }

  function escapeField(value) {
    let text = String(value ?? "");
    // Mitigates spreadsheet formula injection even when preceded by whitespace.
    if (/^\s*[=+\-@]/u.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function serialize(rows) {
    return rows.map(row => row.map(escapeField).join(",")).join("\r\n") + "\r\n";
  }

  const api = { parseRecords, parse, parsePrice, validateRecords, serialize };
  root.CSVTools = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
