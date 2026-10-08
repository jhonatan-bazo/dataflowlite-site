"use strict";
const $ = id => document.getElementById(id);
let source = [], results = [], loadVersion = 0;
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

function setOptions(headers) {
  const patterns = {
    sku: /sku|codigo|código|product.?id|referencia/i,
    name: /nombre|producto|descripcion|descripción|title|name/i,
    price: /precio|costo|cost|price|valor/i
  };
  for (const id of ["sku", "name", "price"]) {
    const select = $(id);
    select.replaceChildren();
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

function load(content) {
  source = [];
  clearResults();
  $("validate").disabled = true;
  try {
    if (new TextEncoder().encode(content).length > MAX_BYTES) {
      throw new Error("El archivo supera el límite de 5 MB.");
    }
    const records = CSVTools.parseRecords(content);
    if (records.length < 2) throw new Error("El CSV necesita una cabecera y registros.");
    if (records[0].cells.length < 3) throw new Error("Se necesitan al menos tres columnas.");
    source = records.slice(1).filter(row => row.cells.some(value => value.trim() !== ""));
    if (!source.length) throw new Error("No hay registros de datos.");
    setOptions(records[0].cells);
    $("validate").disabled = false;
    status("Cargadas " + source.length + " filas. Revisa el mapeo antes de validar.");
  } catch (error) {
    source = [];
    status(error.message || "Error de lectura CSV.", true);
  }
}

$("sample").addEventListener("click", () => {
  loadVersion++;
  $("file").value = "";
  load("Codigo;Producto;Costo\nSKU-102;Teclado USB;42.50\nSKU-205;Mouse óptico;19,90\n;Adaptador;24.00\nSKU-205;Mouse extra;21.00");
});

$("file").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  const current = ++loadVersion;
  source = [];
  clearResults();
  $("validate").disabled = true;
  if (!file) return;
  if (file.size > MAX_BYTES) {
    status("El archivo supera el límite de 5 MB.", true);
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    if (current !== loadVersion) return;
    const content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    load(content);
  } catch (error) {
    if (current === loadVersion) status("No se pudo leer el archivo como CSV UTF-8: " + error.message, true);
  }
});

for (const id of ["sku", "name", "price"]) {
  $(id).addEventListener("change", () => {
    clearResults();
    status("El mapeo cambió. Valida de nuevo antes de exportar.");
  });
}

$("validate").addEventListener("click", () => {
  clearResults();
  const indices = ["sku", "name", "price"].map(id => $(id).value);
  if (indices.some(value => value === "") || new Set(indices).size !== 3) {
    status("Selecciona tres columnas diferentes.", true);
    return;
  }
  try {
    results = CSVTools.validateRecords(source, indices.map(Number));
    const valid = results.filter(row => row.errors.length === 0);
    const invalid = results.length - valid.length;
    $("summary").textContent = results.length + " registros · " +
      valid.length + " válidos · " + invalid + " con errores.";
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
        row.errors.length ? row.errors.join(" | ") : "Válido"
      ];
      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      tr.lastChild.className = row.errors.length ? "error" : "ok";
      table.append(tr);
    }
    $("row-limit").hidden = results.length <= 50;
    $("result").hidden = false;
    $("download").disabled = valid.length === 0;
    $("download-errors").disabled = invalid === 0;
    status("Validación terminada. Ningún SKU repetido se exportará automáticamente.");
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
