const fs = require('fs');
const JSZip = require('./backend/node_modules/jszip');

function getAttr(s, attr){
  const re = new RegExp(attr + '="([^"]+)"', 'i');
  const m = String(s||'').match(re);
  return m ? m[1] : '';
}

(async()=>{
  const buf = fs.readFileSync('проверка/arcmet_ шаблон (1).xlsx');
  const zip = await JSZip.loadAsync(buf);
  const sheetRel = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  const relTags = sheetRel.match(/<Relationship\b[^>]*>/gi) || [];
  let drawingTarget = '';
  for (const t of relTags){
    const type = getAttr(t, 'Type');
    if (/\/drawing$/i.test(type)) drawingTarget = getAttr(t, 'Target');
  }
  const parts=('xl/worksheets/' + drawingTarget).split('/');
  const norm=[]; for(const p of parts){ if(p==='..') norm.pop(); else if(p==='.'||!p){} else norm.push(p);} 
  const drawingPath=norm.join('/');
  console.log('drawingPath', drawingPath);
  const drawingXml = await zip.file(drawingPath).async('string');

  const anchorRe = /<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/gi;
  const anchors = drawingXml.match(anchorRe) || [];
  console.log('anchors', anchors.length);
  anchors.forEach((block, i)=>{
    const from = (block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/i) || []);
    const to = (block.match(/<xdr:to>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/i) || []);
    const embed = ((block.match(/<a:blip\b[^>]*r:embed="([^"]+)"/i) || [])[1] || '');
    const c1 = from[1] ? Number(from[1]) + 1 : null;
    const r1 = from[2] ? Number(from[2]) + 1 : null;
    const c2 = to[1] ? Number(to[1]) + 1 : null;
    const r2 = to[2] ? Number(to[2]) + 1 : null;
    console.log(i+1, 'from', `R${r1}C${c1}`, 'to', `R${r2}C${c2}`, 'embed', embed);
  });
})();
