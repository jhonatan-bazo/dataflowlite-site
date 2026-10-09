const assert = require("node:assert/strict");
const fs = require("node:fs");
const api = require("./logic.js");
const sourceCode = fs.readFileSync(__dirname + "/demo.js", "utf8");

const html = fs.readFileSync(__dirname + "/demo.html", "utf8");
assert.match(html, /id="mode-status"/);
assert.match(html, /id="source-info"/);
assert.match(html, /id="source-preview"/);
assert.match(html, /<script src="logic\.js\?v=20261009-13"><\/script>/);
assert.match(html, /<script src="demo\.js\?v=20261009-13"><\/script>/);


class MockElement {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.value = "";
    this.files = [];
    this.textContent = "";
    this.className = "";
    this.disabled = false;
    this.checked = false;
    this.hidden = false;
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  dispatch(name) { return this.listeners[name]?.({ target: this }); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  remove() {}
  get lastChild() { return this.children.at(-1); }
}
const ids = ["file","sample","feedback","result","sku","name","price",
 "validate","summary","rows","row-limit","download","download-errors",
 "allow-variants","variant-note","mode-status","source-info","source-preview","preview-head","preview-body"];
const controls = Object.fromEntries(ids.map(id => [id,new MockElement()]));
const anchors = [], blobs = [];
const document = {
  getElementById(id) { assert.ok(controls[id]); return controls[id]; },
  createElement(tag) {
    const item = new MockElement();
    if (tag === "a") item.click = () => anchors.push(item.download);
    return item;
  },
  body: new MockElement()
};
const url = {
  createObjectURL(blob) { blobs.push(blob); return "blob:test"; },
  revokeObjectURL() {}
};
class FakeBlob { constructor(parts) { this.parts = parts; } }
new Function("document","CSVTools","TextEncoder","TextDecoder","Blob","URL","setTimeout",sourceCode)(
  document,api,TextEncoder,TextDecoder,FakeBlob,url,()=>{}
);
controls.sample.dispatch("click");
assert.match(controls["source-info"].textContent,/Ejemplo incluido/);
assert.equal(controls["preview-head"].children[0].children[0].textContent,"Codigo");
assert.equal(controls.validate.disabled,false);
assert.match(controls.feedback.textContent,/4 filas/);
controls.validate.dispatch("click");
assert.match(controls.summary.textContent,/4 registros · 1 válido · 3 con errores/);
assert.equal(controls.rows.children.length,4);
const statuses=controls.rows.children.map(tr=>tr.lastChild.textContent);
assert.equal(statuses[0],"Válido");
assert.match(statuses[1],/precios diferentes: 19.90 \/ 21.00/);
assert.match(statuses[1],/nombres diferentes/);
assert.match(statuses[2],/SKU vacío/);
assert.match(statuses[3],/precios diferentes/);
assert.equal(controls.download.disabled,false);
assert.equal(controls["download-errors"].disabled,false);
controls.download.dispatch("click");
assert.equal(anchors.at(-1),"dataflow_validados.csv");
assert.doesNotMatch(blobs.at(-1).parts.join(""),/SKU-205/);
assert.match(blobs.at(-1).parts.join(""),/SKU-102/);
controls["download-errors"].dispatch("click");
assert.equal(anchors.at(-1),"dataflow_errores.csv");
assert.match(blobs.at(-1).parts.join(""),/SKU-205/);
assert.match(blobs.at(-1).parts.join(""),/SKU vacío/);
controls.sku.value="1";
controls.sku.dispatch("change");
assert.equal(controls.download.disabled,true);
assert.equal(controls["download-errors"].disabled,true);
assert.equal(controls.result.hidden,true);
controls.validate.dispatch("click");
assert.match(controls.feedback.textContent,/tres columnas diferentes/);
controls.sku.value="0";
controls.sku.dispatch("change");
controls.validate.dispatch("click");
assert.equal(controls.result.hidden,false);

assert.match(controls["mode-status"].textContent,/SKU único/);
controls["allow-variants"].checked=true;
controls["allow-variants"].dispatch("change");
assert.match(controls["mode-status"].textContent,/se permiten variaciones/);
assert.equal(controls.result.hidden,true);
assert.equal(controls.download.disabled,true);
assert.equal(controls["variant-note"].hidden,false);
controls.validate.dispatch("click");
assert.match(controls.summary.textContent,/4 registros · 3 válidos · 1 con errores · 2 con advertencias/);
const variants=controls.rows.children.map(tr=>tr.lastChild.textContent);
assert.match(variants[1],/Variación admitida/);
assert.match(variants[3],/Variación admitida/);
assert.match(variants[2],/SKU vacío/);
controls.download.dispatch("click");
const allowedCSV=blobs.at(-1).parts.join("");
assert.equal(allowedCSV.split("SKU-205").length-1,2);
controls["download-errors"].dispatch("click");
assert.doesNotMatch(blobs.at(-1).parts.join(""),/SKU-205/);

controls["allow-variants"].checked=false;
controls["allow-variants"].dispatch("change");
assert.equal(controls.result.hidden,true);
assert.equal(controls["variant-note"].hidden,true);
assert.match(controls["mode-status"].textContent,/SKU único/);
controls.validate.dispatch("click");
assert.match(controls.summary.textContent,/4 registros · 1 válido · 3 con errores/);

console.log("PASS: pruebas integradas de interfaz, casilla de variantes, CSV, reportes y mapeo.");
