const assert = require("node:assert/strict");
const t = require("./logic.js");
const records = t.parseRecords(
"Id;Cliente;Email;Importe;Fecha\n1;Ana;ana@example.com;12,50;2026-02-28\n" +
"2;Luis;no-es-email;20;2026-02-30\n1;Ana;ana@example.com;12,50;2026-02-28"
).slice(1);
const headers = ["Id","Cliente","Email","Importe","Fecha"];
const rules = [
 {type:"text",required:true,unique:true},
 {type:"text",required:true,unique:false},
 {type:"email",required:true,unique:false},
 {type:"decimal",required:true,unique:false},
 {type:"date",required:true,unique:false}
];
const checked = t.validateGeneralRecords(records,headers,rules,{rejectIdentical:true});
assert.equal(checked.length,3);
assert.ok(checked[0].errors.some(x=>x.includes("Id: valor duplicado")));
assert.ok(checked[2].errors.some(x=>x.includes("Fila completamente duplicada")));
assert.ok(checked[1].errors.some(x=>x.includes("correo electrónico inválido")));
assert.ok(checked[1].errors.some(x=>x.includes("fecha inexistente")));
const relaxed = t.validateGeneralRecords(records,headers,rules.map(x=>({type:"text",required:false,unique:false})),{rejectIdentical:false});
assert.equal(relaxed.filter(x=>x.errors.length===0).length,3);
const empty = t.validateGeneralRecords(t.parseRecords("A;B\n;2\nX;").slice(1),["A","B"],
 [{type:"text",required:true,unique:true},{type:"integer",required:false,unique:false}],
 {rejectIdentical:false});
assert.ok(empty[0].errors.some(x=>x.includes("valor obligatorio")));
assert.equal(empty[1].errors.length,0);
const unique = t.validateGeneralRecords(t.parseRecords("Code;Value\nA;1\na;2\nB;3").slice(1),
 ["Code","Value"],[{type:"text",required:true,unique:true},{type:"integer",required:true,unique:false}],{rejectIdentical:false});
assert.equal(unique.filter(x=>x.errors.length).length,2);
const leap = t.validateGeneralRecords(t.parseRecords("Date\n2024-02-29\n2025-02-29").slice(1),["Date"],[{type:"date",required:true,unique:false}],{rejectIdentical:false});
assert.equal(leap[0].errors.length,0);
assert.ok(leap[1].errors.length>0);
assert.throws(()=>t.validateGeneralRecords(records,headers,[{type:"text"}]),/reglas/);
assert.throws(()=>t.validateGeneralRecords(records,headers,Array(5).fill({type:"evil"})),/Tipo/);
const output=t.serialize([headers, ...relaxed.map(row=>row.cells)]);
assert.equal(t.parse(output)[0].length,5);
assert.equal(t.parse(output).length,4);

const tolerant=t.parseRecords("A;B;C\n1;2;3\n4;5\n6;7;8;9", {allowColumnMismatch:true});
assert.equal(tolerant.length,4);
assert.deepEqual(tolerant.map(x=>x.line),[1,2,3,4]);
assert.throws(()=>t.parseRecords("A;B;C\n4;5"),/columnas/);
const structural=t.validateGeneralRecords(tolerant.slice(1),["A","B","C"],[
 {type:"integer",required:true,unique:false},
 {type:"integer",required:true,unique:false},
 {type:"integer",required:true,unique:false}
],{rejectIdentical:false});
assert.equal(structural[0].errors.length,0);
assert.match(structural[1].errors.join("; "),/Estructura: 2 columnas; se esperaban 3/);
assert.match(structural[1].errors.join("; "),/valor obligatorio/);
assert.match(structural[2].errors.join("; "),/Estructura: 4 columnas; se esperaban 3/);
assert.deepEqual(structural[2].cells,["6","7","8","9"]);
const repeatLabels=t.validateGeneralRecords(t.parseRecords("A;B\nX;Y\n X ; Y ").slice(1), ["A","B"],
 [{type:"text",required:false,unique:false},{type:"text",required:false,unique:false}],{rejectIdentical:true});
assert.ok(repeatLabels.every(r=>r.errors.join().includes("Fila completamente duplicada")));

console.log("PASS: validación CSV general, filas mal formadas, reglas y exportación.");
