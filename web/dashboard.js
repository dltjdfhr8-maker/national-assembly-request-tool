(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  let departments = [];
  let summary = [];
  let table = null;
  let chart = null;
  let tableBuilt = false;
  let updateVersion = 0;

  async function update() {
    const version = ++updateVersion;
    try {
      const rows = await AppCommon.loadCases();
      if (version !== updateVersion) return;
      const confirmed = rows.filter(row => ['배분확정', '회신중', '회신완료', '재배정요청', '보완요청', '확정'].includes(row.상태));
      $('#count-all').textContent = rows.length;
      $('#count-new').textContent = rows.filter(row => row.상태 === '접수').length;
      $('#count-assigned').textContent = confirmed.length;
      $('#count-other').textContent = rows.filter(row => ['재배정요청', '보완요청'].includes(row.상태)).length;
      if (!departments.length || !tableBuilt) return;

      summary = departments.map(name => ({
        과: name,
        주관: confirmed.filter(row => row.주관과 === name).length,
        협조: confirmed.filter(row => Array.isArray(row.협조과) && row.협조과.includes(name)).length,
      }));
      table.replaceData(summary);
      const top = summary.filter(row => row.주관 || row.협조)
        .sort((a, b) => b.주관 - a.주관 || b.협조 - a.협조 || a.과.localeCompare(b.과, 'ko'))
        .slice(0, 10);
      chart.data.labels = top.map(row => row.과);
      chart.data.datasets[0].data = top.map(row => row.주관);
      chart.data.datasets[1].data = top.map(row => row.협조);
      chart.update();
      $('#overview-note').textContent = top.length
        ? `배분된 ${confirmed.length}문항의 과별 주관·협조 건수입니다. 협조 과는 한 문항에 여러 개일 수 있습니다.`
        : '배분된 문항이 없습니다. 배분 화면에서 문항을 확정하면 현황이 나타납니다.';
      $('#export-xlsx').disabled = false;
    } catch (error) {
      $('#home-message').className = 'message error';
      $('#home-message').textContent = error.message;
    }
  }

  $('#reset-cases').addEventListener('click', async () => {
    const count = (await AppCommon.loadCases()).length;
    if (!confirm(`이 브라우저에 저장된 문항 ${count}건과 배분 이력을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    AppCommon.resetCases();
    update();
    $('#home-message').className = 'message success';
    $('#home-message').textContent = '이 브라우저의 접수·배분 기록을 초기화했습니다.';
  });

  $('#department-filter').addEventListener('input', event => {
    if (table) table.setFilter('과', 'like', event.target.value);
  });

  $('#export-xlsx').addEventListener('click', () => {
    const sheet = XLSX.utils.json_to_sheet(summary, { header: ['과', '주관', '협조'] });
    sheet['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '과별 배분 현황');
    XLSX.writeFile(workbook, '과별_배분_현황.xlsx');
  });

  addEventListener('storage', update);
  addEventListener('cases-updated', update);
  $('#storage-mode').textContent = AppCommon.storageLabel();
  $('#reset-cases').hidden = AppCommon.isRemote;
  update();
  AppCommon.loadData().then(data => {
    departments = data.departments;
    chart = new Chart($('#department-chart'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: '주관', data: [], backgroundColor: '#0d6d86' },
        { label: '협조', data: [], backgroundColor: '#76b9b6' },
      ] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    table = new Tabulator('#department-table', {
      data: [], layout: 'fitColumns', height: 380, placeholder: '표시할 과가 없습니다.',
      columns: [
        { title: '과', field: '과', sorter: 'string', minWidth: 180 },
        { title: '주관 문항', field: '주관', sorter: 'number', hozAlign: 'right' },
        { title: '협조 문항', field: '협조', sorter: 'number', hozAlign: 'right' },
      ],
      initialSort: [{ column: '주관', dir: 'desc' }, { column: '과', dir: 'asc' }],
    });
    table.on('tableBuilt', () => { tableBuilt = true; update(); });
  }).catch(error => {
    $('#overview-note').textContent = `조직도를 읽지 못했습니다: ${error.message}`;
  });
})();
