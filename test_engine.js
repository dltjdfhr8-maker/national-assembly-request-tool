const fs = require('node:fs');
const path = require('node:path');
const engine = require('./web/engine.js');

async function main() {
  await engine.load();
  const testPath = path.join(__dirname, 'data', '시험_요구문항_40건.csv');
  const tests = engine.parseCsv(fs.readFileSync(testPath, 'utf8'));
  let first = 0;
  let topThree = 0;
  const wrong = [];

  for (const test of tests) {
    const candidates = engine.classify(test['요구내용']);
    const answers = candidates.map(item => item.과);
    const expected = test['정답_배분과'];
    if (answers[0] === expected) first++;
    else wrong.push({
      시험번호: test['시험번호'],
      요구내용: test['요구내용'],
      정답: expected,
      '엔진 결과': answers.length ? answers.join(' > ') : '확인필요(후보 없음)',
    });
    if (answers.includes(expected)) topThree++;
  }

  console.log(`1순위 정답 ${first}/${tests.length} · 3순위 안 ${topThree}/${tests.length}`);
  console.log('틀린 문항 (1순위 기준)');
  console.log('시험번호 | 요구내용 | 정답 | 엔진 결과');
  for (const row of wrong) {
    console.log(`${row.시험번호} | ${row.요구내용} | ${row.정답} | ${row['엔진 결과']}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
