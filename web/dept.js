const $ = selector => document.querySelector(selector);
let data = null;
let renderVersion = 0;

function el(tag, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function message(node, text, kind = '') {
  node.textContent = text;
  node.className = `message ${kind}`.trim();
}
function actor() {
  const name = $('#actor').value.trim();
  if (!name) throw new Error('담당자 표시를 입력해 주세요.');
  return name;
}
async function readWorkbook(file, item) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('엑셀의 첫 시트를 읽지 못했습니다.');
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: false });
  return { fileName: file.name, ...AppValidate.parseReply(matrix, item) };
}
function selectField(labelText, id) {
  const label = el('label', '', 'field');
  label.append(document.createTextNode(labelText));
  const select = document.createElement('select');
  select.id = id;
  select.append(el('option', '희망 과 없음'));
  select.firstChild.value = '';
  for (const name of data.departments) {
    const option = el('option', name);
    option.value = name;
    select.append(option);
  }
  label.append(select);
  return { label, select };
}
function cardFor(item, dept) {
  const card = el('article', '', 'dept-card');
  card.dataset.id = item.id;
  const title = el('h3', `${item.의원} · ${item.문항번호}번`, 'dept-card-title');
  title.append(el('span', item.상태, 'badge pending'));
  card.append(title, el('p', `${item.위원회} · 제출기한 ${item.제출기한 || '미정'} · ${dept === item.주관과 ? '주관' : '협조'}`, 'dept-meta'));
  card.append(el('p', item.요구내용, 'dept-request'));
  if (item.세부항목) card.append(el('p', item.세부항목, 'dept-detail'));
  if (item.상태 === '보완요청' && item.보완?.length) {
    const request = item.보완.at(-1);
    card.append(el('p', `보완 대상: ${request.과} · 사유: ${request.사유}`, 'reassign-note'));
  }
  card.append(AppCommon.historyNode(item, data.history));
  const currentReply = (item.회신 || []).filter(entry => entry.과 === dept && entry.배분번호 === item.배분번호).at(-1);
  if (currentReply) card.append(el('p', `제출한 회신: ${currentReply.파일명} · ${currentReply.시각}`, 'reply-saved'));
  if (!['배분확정', '회신중', '보완요청'].includes(item.상태)
    || (item.상태 === '보완요청' && item.보완?.at(-1)?.과 !== dept)) {
    card.append(el('p', item.상태 === '재배정요청' ? '재배정 요청을 검토 중입니다.'
      : item.상태 === '보완요청' ? '보완 대상 과의 회신을 기다리고 있습니다.'
        : '현재 상태에서는 회신이나 재배정을 제출할 수 없습니다.', 'help'));
    return card;
  }
  const replyArea = el('div', '', 'dept-form');
  const fileLabel = el('label', '회신 엑셀 올리기', 'field');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  fileLabel.append(fileInput);
  const preview = el('p', '선택한 파일이 없습니다.', 'help');
  const memoLabel = el('label', '메모', 'field');
  const memo = document.createElement('textarea');
  memo.rows = 2;
  memo.placeholder = '자료 없음 등 전달할 내용을 입력하세요.';
  memoLabel.append(memo);
  const submit = el('button', '회신 제출', 'button primary');
  submit.type = 'button';
  submit.disabled = true;
  const replyMessage = el('div', '', 'message');
  let upload = null;
  fileInput.addEventListener('change', async () => {
    upload = null;
    submit.disabled = true;
    try {
      const file = fileInput.files[0];
      if (!file) { preview.textContent = '선택한 파일이 없습니다.'; return; }
      upload = await readWorkbook(file, item);
      preview.textContent = `${upload.fileName} · ${upload.rows.length}행 · ${upload.requirement}`;
      message(replyMessage, upload.checks.length
        ? `확인필요 ${upload.checks.length}건: ${upload.checks.join(' / ')}`
        : '형식과 기본 금액 점검을 마쳤습니다. 요구 문항과 내용이 맞는지 확인해 주세요.', upload.checks.length ? 'error' : 'success');
      submit.disabled = false;
    } catch (error) { preview.textContent = '파일을 읽지 못했습니다.'; message(replyMessage, error.message, 'error'); }
  });
  submit.addEventListener('click', async () => {
    try {
      if (!upload) throw new Error('회신 엑셀을 먼저 올려 주세요.');
      if (upload.checks.length && !confirm(`확인필요 ${upload.checks.length}건이 있습니다. 원본을 고치지 않고 이 상태로 회신을 제출할까요?`)) return;
      submit.disabled = true;
      const result = await AppCommon.reply(item.id, dept, actor(), upload.fileName, upload.rows, memo.value,
        upload.checks, data.departments);
      await render();
      message($('#dept-message'), `${result.의원} ${result.문항번호}번 회신을 제출했습니다.`, 'success');
    } catch (error) { message(replyMessage, error.message, 'error'); submit.disabled = false; }
  });
  replyArea.append(fileLabel, preview, memoLabel, submit, replyMessage);

  const reassign = el('div', '', 'dept-form reassign-form');
  const reasonLabel = el('label', '재배정 사유', 'field');
  const reason = document.createElement('textarea');
  reason.rows = 2;
  reason.placeholder = '소관이 아닌 이유를 입력해 주세요.';
  reasonLabel.append(reason);
  const desired = selectField('희망 과', `desired-${item.id.replace(/[^a-zA-Z0-9]/g, '-')}`);
  const requestButton = el('button', '재배정 요청', 'button');
  requestButton.type = 'button';
  const requestMessage = el('div', '', 'message');
  requestButton.addEventListener('click', async () => {
    try {
      requestButton.disabled = true;
      const result = await AppCommon.requestReassignment(item.id, dept, actor(), reason.value, desired.select.value, data.departments);
      await render();
      message($('#dept-message'), `${result.의원} ${result.문항번호}번 재배정을 요청했습니다.`, 'success');
    } catch (error) { message(requestMessage, error.message, 'error'); requestButton.disabled = false; }
  });
  reassign.append(reasonLabel, desired.label, requestButton, requestMessage);
  card.append(replyArea, reassign);
  return card;
}
async function render() {
  const version = ++renderVersion;
  const dept = $('#my-dept').value;
  const container = $('#dept-cards');
  if (!dept) { container.replaceChildren(el('div', '과를 선택해 주세요.', 'empty')); $('#dept-count').textContent = '0문항'; return; }
  try {
    const cases = await AppCommon.loadCases();
    if (version !== renderVersion) return;
    const mine = cases.filter(item => item.주관과 === dept || (item.협조과 || []).includes(dept));
    $('#dept-count').textContent = `${mine.length}문항`;
    container.replaceChildren(...(mine.length ? mine.map(item => cardFor(item, dept)) : [el('div', '이 과에 배분된 문항이 없습니다.', 'empty')]));
  } catch (error) { message($('#dept-message'), error.message, 'error'); }
}

$('#storage-mode').textContent = AppCommon.storageLabel();
$('#my-dept').addEventListener('change', render);
$('#refresh').addEventListener('click', render);
addEventListener('storage', render);
addEventListener('cases-updated', render);
try {
  data = await AppCommon.loadData();
  for (const name of data.departments) {
    const option = el('option', name);
    option.value = name;
    $('#my-dept').append(option);
  }
  $('#data-status').textContent = '26개 과 · 과거 520건 읽음';
  await render();
} catch (error) {
  $('#data-status').textContent = '자료 읽기 실패';
  message($('#dept-message'), error.message, 'error');
}
