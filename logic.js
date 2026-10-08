/* Parser and exporter for illustrative CSV preview. No network calls. */
(function(root){
  "use strict";
  function detectDelimiter(src){
    const first=src.split(/\r?\n/,1)[0]||"";
    const candidates=[";",",","\t"];
    let quote=false,counts=[0,0,0];
    for(let i=0;i<first.length;i++){
      const c=first[i];
      if(c==='"'){if(quote&&first[i+1]==='"')i++;else quote=!quote}
      else if(!quote){const x=candidates.indexOf(c);if(x>=0)counts[x]++}
    }
    const mx=Math.max(...counts);if(mx===0)throw Error("No se detectó delimitador CSV.");
    return candidates[counts.indexOf(mx)];
  }
  function parse(content){
    const text=content.replace(/^\uFEFF/,"");
    const delimiter=detectDelimiter(text);
    const out=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){
        if(quoted&&text[i+1]==='"'){field+='"';i++}
        else if(!quoted&&field===''){quoted=true}
        else if(quoted){quoted=false}
        else throw Error("Comillas inesperadas en CSV.")
      }else if(!quoted&&c===delimiter){row.push(field);field=""}
      else if(!quoted&&(c==='\n'||c==='\r')){
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field);out.push(row);row=[];field="";
      }else field+=c;
    }
    if(quoted)throw Error("CSV incorrecto: hay comillas sin cerrar.");
    if(field!==""||row.length){row.push(field);out.push(row)}
    if(out.length&&out.some(r=>r.length!==out[0].length))throw Error("Las filas tienen distinta cantidad de columnas.");
    return out;
  }
  function parsePrice(raw){
    if(!raw)return null;
    let s=raw.replace(/\s/g,"");
    if(!/^\d+(?:[.,]\d+)?$/.test(s))return null;
    if(s.includes(",")&&s.includes("."))return null; // ambiguous locale intentionally rejected
    if(s.includes(","))s=s.replace(",",".");
    const n=Number(s);
    return Number.isFinite(n)&&n>=0&&n<=999999999?n:null;
  }
  function escapeField(value){
    let s=String(value??"");
    if(/^[=+\-@\t\r]/.test(s))s="'"+s; // prevent spreadsheet formula execution
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function serialize(rows){return rows.map(r=>r.map(escapeField).join(",")).join("\r\n")+"\r\n"}
  root.CSVTools={parse,parsePrice,serialize};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.CSVTools;
})(typeof window!=="undefined"?window:globalThis);
