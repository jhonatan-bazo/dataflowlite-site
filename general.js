"use strict";
const $ = id => document.getElementById(id);
const MAX_BYTES = 5 * 1024 * 1024;
let version = 0, headers = [], records = [], results = [], fileName = "";

function report(message, failed = false) {
  $("feedback").textContent = message;
  $("feedback").className = failed ? "error" : "ok";
}
function clearResults() {
  results = [];
  $("result").hidden = true;
  $("download-valid").disabled = true;
  $("download-errors").disabled = true;
}
function resetSource(message = "Ningún archivo cargado.") {
  headers = [];
  records = [];
  fileName = "";
  clearResults();
  $("validate").disabled = true;
  $("preview").hidden = true;
  $("source-info").textContent = message;
  $("rules").replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = "Carga un CSV para configurar reglas.";
  row.append(cell);
  $("rules").append(row);
}
function renderPreview() {
  $("preview-head").replaceChildren();
  $("preview-rows").replaceChildren();
  const row = document.createElement("tr");
  headers.forEach((header, index) => {
    const th = document.createElement("th");
    th.textContent = (header || "(sin nombre)") + " · " + (index + 1);
    row.append(th);
  });
  $("preview-head").append(row);
  for (const record of records.slice(0, 3)) {
    const tr = document.createElement("tr");
    for (const value of record.cells) {
      const td = document.createElement("td");
      td.textContent = value.length > 120 ? value.slice(0, 120) + "…" : value;
      tr.append(td);
    }
    $("preview-rows").append(tr);
  }
  $("preview").hidden = false;
}
function buildRules() {
  $("rules").replaceChildren();
  for (let index = 0; index < headers.length; index++) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("td");
    labelCell.textContent = (headers[index] || "(sin nombre)") + " · columna " + (index + 1);
    tr.append(labelCell);
    const typeCell = document.createElement("td");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Tipo de " + (headers[index] || "columna " + (index + 1)) + " (columna " + (index + 1) + ")");
    const typeOptions = [
      ["text", "Texto"], ["integer", "Entero"], ["decimal", "Decimal"],
      ["date", "Fecha AAAA-MM-DD"], ["email", "Correo"]
    ];
    for (const [value, title] of typeOptions) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      select.append(option);
    }
    select.value = "text";
    typeCell.append(select);
    tr.append(typeCell);
    for (const title of ["obligatorio", "único"]) {
      const td = document.createElement("td");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.setAttribute("aria-label", title + " para " + (headers[index] || "columna " + (index + 1)) + " (columna " + (index + 1) + ")");
      td.append(check);
      tr.append(td);
    }
    $("rules").append(tr);
  }
}
function loadCSV(text, label, encoding = "") {
  resetSource("Cargando " + label + "…");
  try {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("El archivo supera 5 MB.");
    const parsed = CSVTools.parseRecords(text, {allowColumnMismatch: true});
    if (parsed.length < 2) throw Error("Se necesitan encabezados y al menos una fila de datos.");
    const actual = parsed.slice(1).filter(row => row.cells.some(cell => cell.trim() !== ""));
    if (!actual.length) throw Error("El archivo no contiene registros.");
    headers = parsed[0].cells;
    records = actual;
    fileName = label;
    renderPreview();
    buildRules();
    $("validate").disabled = false;
    const mismatched = records.filter(row => row.cells.length !== headers.length).length;
    $("source-info").textContent = label + " · " + records.length + " registros · " +
      headers.length + " columnas" + (mismatched ? " · " + mismatched + " filas con cantidad de columnas diferente" : "") + (encoding ? " · " + encoding : "") +
      " · " + headers.join(" | ");
    report(mismatched ? "Archivo cargado con " + mismatched + " filas de estructura distinta. Valida para ver cuáles son." : "Archivo cargado. Configura tus reglas y pulsa Validar CSV.");
  } catch (error) {
    resetSource("No se pudo cargar " + label + ": " + error.message);
    report(error.message, true);
  }
}

function decodeBytes(input) {
  const bytes = new Uint8Array(input);
  const isLe = bytes[0] === 255 && bytes[1] === 254;
  const isBe = bytes[0] === 254 && bytes[1] === 255;
  let encoding = isLe ? "utf-16le" : isBe ? "utf-16be" : "utf-8";
  let text;
  try {
    text = new TextDecoder(encoding, {fatal: true}).decode(bytes);
  } catch (error) {
    if (encoding !== "utf-8") throw Error("Codificación UTF-16 inválida.");
    encoding = "windows-1252";
    text = new TextDecoder(encoding, {fatal: true}).decode(bytes);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    throw Error("El archivo parece binario. Exporta CSV de texto.");
  }
  return {text, encoding};
}

$("sample").addEventListener("click", () => {
  version++;
  $("file").value = "";
  loadCSV("Cliente;Correo;Monto;Fecha\nAna;ana@example.com;120.50;2026-10-01\nLuis;correo-invalido;55;2026-10-02\nAna;ana@example.com;120.50;2026-10-01\nMaría;maria@example.com;80.25;2026-10-04", "Ejemplo de clientes");
  if (fileName === "Ejemplo de clientes") {
    const rows = [...$("rules").children];
    rows[1].children[1].firstChild.value = "email";
    rows[1].children[2].firstChild.checked = true;
    rows[2].children[1].firstChild.value = "decimal";
    rows[3].children[1].firstChild.value = "date";
    report("Ejemplo cargado con reglas para correo, importe y fecha. Puedes cambiarlas.");
  }
});
$("file").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0], current = ++version;
  resetSource(file ? "Abriendo " + file.name + "…" : "Ningún archivo seleccionado.");
  if (!file) return;
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
    report("Este archivo no es CSV. Convierte XLSX a CSV antes de cargarlo.", true);
    $("source-info").textContent = "No se cargó " + file.name;
    return;
  }
  if (file.size > MAX_BYTES) {
    report("El archivo supera el límite de 5 MB.", true);
    $("source-info").textContent = "No se cargó " + file.name;
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    if (current !== version) return;
    const {text, encoding} = decodeBytes(buffer);
    loadCSV(text, file.name, encoding);
  } catch (error) {
    if (current !== version) return;
    resetSource("No se cargó " + file.name + ": " + error.message);
    report(error.message, true);
  }
});

$("rules").addEventListener("change", () => {
  clearResults();
  report("Las reglas cambiaron. Vuelve a validar antes de exportar.");
});
$("reject-identical").addEventListener("change", () => {
  clearResults();
  report("Las reglas cambiaron. Vuelve a validar antes de exportar.");
});

function currentRules() {
  return [...$("rules").children].map(tr => ({
    type: tr.children[1].firstChild.value,
    required: tr.children[2].firstChild.checked,
    unique: tr.children[3].firstChild.checked
  }));
}
$("validate").addEventListener("click", () => {
  clearResults();
  if (!fileName || !records.length) {
    report("Primero debes cargar un CSV válido.", true);
    return;
  }
  try {
    results = CSVTools.validateGeneralRecords(records, headers, currentRules(), {
      rejectIdentical: $("reject-identical").checked
    });
    const valid = results.filter(row => row.errors.length === 0);
    const invalid = results.length - valid.length;
    $("summary").textContent = results.length + " registros · " +
      valid.length + (valid.length === 1 ? " válido" : " válidos") + " · " + invalid + " con errores.";
    $("result-rows").replaceChildren();
    for (const row of results.slice(0, 50)) {
      const tr = document.createElement("tr");
      const cells = [
        row.line,
        row.cells.map(value => value.length > 65 ? value.slice(0, 65) + "…" : value).join(" | "),
        row.errors.length ? row.errors.join(" | ") : "Válido"
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      tr.lastChild.className = row.errors.length ? "error" : "ok";
      $("result-rows").append(tr);
    }
    $("row-limit").hidden = results.length <= 50;
    $("result").hidden = false;
    $("download-valid").disabled = valid.length === 0;
    $("download-errors").disabled = invalid === 0;
    report("Validación completada. Se conservarán todas las columnas.");
  } catch (error) {
    report("Error al validar: " + error.message, true);
  }
});
function saveCSV(rows, filename) {
  const csv = CSVTools.serialize(rows);
  const url = URL.createObjectURL(new Blob(["\uFEFF",csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
$("download-valid").addEventListener("click", () => {
  const valid = results.filter(row => !row.errors.length);
  if (!valid.length) return;
  saveCSV([headers, ...valid.map(row => row.cells)], "dataflow_csv_validado.csv");
});
$("download-errors").addEventListener("click", () => {
  const bad = results.filter(row => row.errors.length);
  if (!bad.length) return;
  const hasExtras = bad.some(row => row.cells.length > headers.length);
  const head = ["Fila origen", ...headers, ...(hasExtras ? ["Columnas adicionales (JSON)"] : []), "Errores"];
  const rows = bad.map(row => [
    row.line,
    ...headers.map((_, index) => row.cells[index] ?? ""),
    ...(hasExtras ? [JSON.stringify(row.cells.slice(headers.length))] : []),
    row.errors.join(" | ")
  ]);
  saveCSV([head, ...rows], "dataflow_csv_errores.csv");
});
resetSource();
