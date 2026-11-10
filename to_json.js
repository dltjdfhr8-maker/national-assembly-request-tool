const fs = require('node:fs');
const path = require('node:path');

const input = path.join(__dirname, 'data', 'A부_조직도_26개과.csv');
const output = path.join(__dirname, 'org.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV 따옴표가 닫히지 않았습니다.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
const headers = rows.shift();
if (!headers) throw new Error('CSV가 비어 있습니다.');
const positions = ['실국', '과', '대표키워드'].map(name => {
  const index = headers.indexOf(name);
  if (index < 0) throw new Error(`필수 열이 없습니다: ${name}`);
  return index;
});

const org = rows.map((row, index) => {
  if (row.length !== headers.length) {
    throw new Error(`${index + 2}행의 열 수가 헤더와 다릅니다.`);
  }
  return {
    실국: row[positions[0]].trim(),
    과: row[positions[1]].trim(),
    대표키워드: row[positions[2]].split('|').map(word => word.trim()).filter(Boolean),
  };
});

fs.writeFileSync(output, JSON.stringify(org, null, 2) + '\n', 'utf8');
console.log(`원소 수: ${org.length}`);
console.log('첫 원소:', JSON.stringify(org[0]));
