"use strict";
const $ = id => document.getElementById(id);
let source = [], results = [], loadVersion = 0;
let loadedSource = "";
const MAX_BYTES = 5 * 1024 * 1024;

function status(message, error = false) {
  const element = $("feedback");
  element.textContent = message;
  element.className = error ? "error" : "ok";
}

function clearResults() {
  results = [];
  $("result").hidden = true;
  $("download").disabled = true;
  $("download-errors").disabled = true;
}

function updateModeStatus() {
  const checked = $("allow-variants").checked === true;
  $("variant-note").hidden = !checked;
  $("mode-status").textContent = checked
    ? "Modo activo: se permiten variaciones de SKU cuando difiere el nombre o el precio. Se rechazan duplicados idénticos."
    : "Modo activo: SKU único. Los SKU repetidos se rechazan.";
  return checked;
}

function setOptions(headers) {
  const patterns = {
    sku: /sku|codigo|código|product.?id|referencia/i,
    name: /nombre|producto|descripcion|descripción|title|name/i,
    price: /precio|costo|cost|price|valor/i
  };
  for (const id of ["sku", "name", "price"]) {
    const select = $(id);
    select.replaceChildren();
    select.disabled = headers.length === 0;
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Selecciona columna —";
    select.append(empty);
    headers.forEach((header, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = (header.trim() || "(sin encabezado)") + " · columna " + (index + 1);
      select.append(option);
    });
    const match = headers.findIndex(header => patterns[id].test(header));
    select.value = match >= 0 ? String(match) : "";
  }
}

function resetSource(message = "Ningún CSV cargado.") {
  source = [];
  loadedSource = "";
  clearResults();
  $("validate").disabled = true;
  setOptions([]);
  $("source-info").textContent = message;
  $("source-preview").hidden = true;
}
function renderPreview(headers, records) {
  const head = $("preview-head"), body = $("preview-body");
  head.replaceChildren();
  body.replaceChildren();
  const headerRow = document.createElement("tr");
  for (const h of headers) {
    const cell = document.createElement("th");
    cell.textContent = h || "(sin nombre)";
    headerRow.append(cell);
  }
  head.append(headerRow);
  for (const record of records.slice(0, 3)) {
    const tr = document.createElement("tr");
    for (const cellValue of record.cells) {
      const td = document.createElement("td");
      td.textContent = cellValue.length > 120 ? cellValue.slice(0, 120) + "…" : cellValue;
      tr.append(td);
    }
    body.append(tr);
  }
  $("source-preview").hidden = false;
}
function load(content, label, decoding = "") {
  resetSource("Leyendo " + label + "…");
  try {
    if (new TextEncoder().encode(content).length > MAX_BYTES) throw Error("Supera el límite de 5 MB.");
    const records = CSVTools.parseRecords(content);
    if (records.length < 2) throw Error("El CSV necesita encabezados y registros.");
    const headers = records[0].cells;
    if (headers.length < 3) throw Error("Solo se detectaron " + headers.length + " columnas; el mínimo es 3. Revisa el separador.");
    const rows = records.slice(1).filter(row => row.cells.some(value => value.trim() !== ""));
    if (!rows.length) throw Error("No hay registros de datos.");
    source = rows;
    loadedSource = label;
    setOptions(headers);
    renderPreview(headers, rows);
    $("validate").disabled = false;
    $("source-info").textContent = "Origen: " + label + " · " + rows.length + " filas · " +
      headers.length + " columnas" + (decoding ? " · " + decoding : "") +
      ". Encabezados: " + headers.map(h => h || "(sin nombre)").join(" | ");
    status("Cargadas " + rows.length + " filas de " + label + ". Revisa el mapeo.");
  } catch (error) {
    resetSource("No se cargó " + label + ": " + error.message + ". Las columnas anteriores fueron eliminadas.");
    status("Error al leer " + label + ": " + error.message, true);
  }
}
$("sample").addEventListener("click", () => {
  loadVersion++;
  $("file").value = "";
  load("Codigo;Producto;Costo\nSKU-102;Teclado USB;42.50\nSKU-205;Mouse óptico;19,90\n;Adaptador;24.00\nSKU-205;Mouse extra;21.00", "Ejemplo incluido");
});
$("file").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  const version = ++loadVersion;
  resetSource(file ? "Leyendo " + file.name + "…" : "Ningún CSV seleccionado.");
  if (!file) return;
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
    resetSource("No se cargó " + file.name + ". Exporta como CSV desde Excel; XLSX no es compatible.");
    status("Archivo no compatible. Guarda como CSV, no XLSX.", true);
    return;
  }
  if (file.size > MAX_BYTES) {
    resetSource("No se cargó " + file.name + ": supera 5 MB.");
    status("El archivo supera 5 MB.", true);
    return;
  }
  try {
    const bytes = await file.arrayBuffer();
    if (version !== loadVersion) return;
    const b = new Uint8Array(bytes);
    const utf16le = b[0] === 255 && b[1] === 254;
    const utf16be = b[0] === 254 && b[1] === 255;
    let encoding = utf16le ? "utf-16le" : utf16be ? "utf-16be" : "utf-8";
    let content;
    try {
      content = new TextDecoder(encoding, {fatal: true}).decode(bytes);
    } catch (_) {
      if (encoding !== "utf-8") throw Error("Codificación UTF-16 inválida.");
      encoding = "windows-1252";
      content = new TextDecoder(encoding, {fatal: true}).decode(bytes);
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) throw Error("Archivo binario: exporta CSV de texto.");
    load(content, file.name, encoding);
    if (encoding === "windows-1252" && !$("validate").disabled) {
      status("Archivo cargado como Windows-1252. Revisa las tildes antes de exportar.");
    }
  } catch (error) {
    if (version !== loadVersion) return;
    resetSource("No se cargó " + file.name + ": " + error.message);
    status("Error al leer " + file.name + ": " + error.message, true);
  }
});
resetSource();

for (const id of ["sku", "name", "price", "allow-variants"]) {
  $(id).addEventListener("change", () => {
    clearResults();
    updateModeStatus();
    status("Cambió la configuración. Valida de nuevo antes de exportar.");
  });
}
updateModeStatus();

$("validate").addEventListener("click", () => {
  clearResults();
  if (!loadedSource || !source.length) {
    status("Primero carga un CSV real o el ejemplo.", true);
    return;
  }
  const indices = ["sku", "name", "price"].map(id => $(id).value);
  if (indices.some(value => value === "") || new Set(indices).size !== 3) {
    status("Selecciona tres columnas diferentes.", true);
    return;
  }
  try {
    const allowDistinctSku = updateModeStatus();
    results = CSVTools.validateRecords(source, indices.map(Number), { allowDistinctSku });
    const valid = results.filter(row => row.errors.length === 0);
    const invalid = results.length - valid.length;
    const warned = valid.filter(row => row.warnings.length > 0).length;
    $("summary").textContent = results.length + " registros · " +
      valid.length + (valid.length === 1 ? " válido" : " válidos") + " · " + invalid +
      " con errores" + (warned ? " · " + warned + " con advertencias" : "") + ".";
    const table = $("rows");
    table.replaceChildren();
    for (const row of results.slice(0, 50)) {
      const tr = document.createElement("tr");
      const price = row.price === null ? row.rawPrice || "—" : row.price.toFixed(2);
      const values = [
        row.line,
        row.sku,
        row.name,
        price,
        row.errors.length ? row.errors.join(" | ") :
          row.warnings.length ? "Variación admitida: " + row.warnings.join(" | ") : "Válido"
      ];
      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      tr.lastChild.className = row.errors.length ? "error" : row.warnings.length ? "warning" : "ok";
      table.append(tr);
    }
    $("row-limit").hidden = results.length <= 50;
    $("result").hidden = false;
    $("download").disabled = valid.length === 0;
    $("download-errors").disabled = invalid === 0;
    status(allowDistinctSku ?
      "Validación en modo variantes completada. Se exportan las variaciones admitidas con advertencia." :
      "Validación en modo SKU único completada. Todos los SKU repetidos quedaron excluidos.");
  } catch (error) {
    status(error.message || "No se pudo validar el archivo.", true);
  }
});

function saveCSV(rows, filename) {
  const csv = CSVTools.serialize(rows);
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

$("download").addEventListener("click", () => {
  const valid = results.filter(row => row.errors.length === 0);
  if (!valid.length) return;
  saveCSV([
    ["SKU", "Nombre", "Precio"],
    ...valid.map(row => [row.sku, row.name, row.price.toFixed(2)])
  ], "dataflow_validados.csv");
});

$("download-errors").addEventListener("click", () => {
  const errors = results.filter(row => row.errors.length > 0);
  if (!errors.length) return;
  saveCSV([
    ["Fila origen", "SKU", "Nombre", "Precio original", "Errores"],
    ...errors.map(row => [
      row.line, row.sku, row.name, row.rawPrice, row.errors.join(" | ")
    ])
  ], "dataflow_errores.csv");
});
