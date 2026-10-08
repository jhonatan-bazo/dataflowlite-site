"use strict";
const $ = id => document.getElementById(id);
let source = [], results = [];
const status = (message, error = false) => {
  const e = $("feedback");
  e.textContent = message;
  e.className = error ? "error" : "ok";
};
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
      option.textContent = header || "Columna " + (index + 1);
      select.append(option);
    });
    const match = headers.findIndex(header => patterns[id].test(header));
    select.value = match >= 0 ? String(match) : "";
  }
}
function load(content) {
  source = []; results = [];
  $("result").hidden = true;
  $("download").disabled = true;
  $("validate").disabled = true;
  try {
    if (content.length > 5 * 1024 * 1024) throw Error("El archivo supera 5 MB.");
    const rows = CSVTools.parse(content);
    if (rows.length < 2) throw Error("El CSV necesita cabecera y registros.");
    if (rows[0].length < 3) throw Error("Se necesitan al menos tres columnas.");
    const validRows = rows.slice(1).filter(row => row.some(value => value.trim() !== ""));
    if (!validRows.length) throw Error("No hay registros de datos.");
    source = validRows;
    setOptions(rows[0]);
    $("validate").disabled = false;
    status("Cargadas " + source.length + " filas. Revisa el mapeo.");
  } catch (error) { status(error.message, true); }
}
$("sample").addEventListener("click", () => load("Codigo;Producto;Costo\nSKU-102;Teclado USB;42.50\nSKU-205;Mouse óptico;19,90\n;Adaptador;24.00\nSKU-205;Mouse extra;21.00"));
$("file").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { status("El archivo supera 5 MB.", true); return; }
  try {
    const content = await file.text();
    if (content.includes("\uFFFD")) throw Error("Posible codificación no compatible. Usa UTF-8.");
    load(content);
  } catch (error) { $("validate").disabled = true; status(error.message || "No se pudo leer el CSV.", true); }
});
$("validate").addEventListener("click", () => {
  const keys = ["sku", "name", "price"].map(id => $(id).value);
  if (keys.some(value => value === "") || new Set(keys).size !== 3) {
    status("Selecciona tres columnas diferentes.", true); return;
  }
  const indices = keys.map(Number);
  const seen = new Set();
  results = source.map((row, index) => {
    const sku = (row[indices[0]] || "").trim();
    const name = (row[indices[1]] || "").trim();
    const rawPrice = (row[indices[2]] || "").trim();
    const errors = [];
    if (!sku) errors.push("SKU vacío");
    if (!name) errors.push("Nombre vacío");
    const price = CSVTools.parsePrice(rawPrice);
    if (price === null) errors.push("Precio inválido");
    if (sku && seen.has(sku.toLowerCase())) errors.push("SKU duplicado");
    if (sku) seen.add(sku.toLowerCase());
    return { line: index + 2, sku, name, price, errors };
  });
  const good = results.filter(row => !row.errors.length);
  $("summary").textContent = results.length + " registros · " + good.length + " válidos · " + (results.length - good.length) + " con errores.";
  const tbody = $("rows");
  tbody.replaceChildren();
  for (const row of results.slice(0, 50)) {
    const tr = document.createElement("tr");
    const values = [row.line, row.sku, row.name, row.price === null ? "—" : row.price.toFixed(2), row.errors.length ? row.errors.join(", ") : "Válido"];
    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    tr.lastChild.className = row.errors.length ? "error" : "ok";
    tbody.append(tr);
  }
  $("result").hidden = false;
  $("download").disabled = !good.length;
  status("Validación terminada. Se muestran hasta 50 filas.");
});
$("download").addEventListener("click", () => {
  const rows = [["SKU", "Nombre", "Precio"], ...results.filter(row => !row.errors.length).map(row => [row.sku, row.name, row.price.toFixed(2)])];
  const csv = CSVTools.serialize(rows);
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "dataflow_ejemplo_validado.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
});
