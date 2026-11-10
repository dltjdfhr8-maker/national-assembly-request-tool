const recommendations = require('../../web/generated/recommend.json');

exports.handler = async event => {
  const sample = event.queryStringParameters?.sample || 'T01';
  const result = recommendations[sample];
  return {
    statusCode: result ? 200 : 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(result || { error: '교육용 시험번호를 찾지 못했습니다.' }),
  };
};
