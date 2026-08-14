/**
 * 음료 주문 신청 — Google Apps Script
 *
 * 설정 방법
 * 1. 새 Google 스프레드시트 생성 (또는 기존 시트 사용)
 * 2. 확장 프로그램 → Apps Script → 이 파일 내용 전체 붙여넣기
 * 3. 배포 → 새 배포 → 유형: 웹 앱
 *      - 실행 계정: 나
 *      - 액세스 권한: 모든 사용자 (익명 포함)  ← 반드시 이 설정
 * 4. 배포 후 나오는 URL(.../exec)을 복사해
 *    index.html 상단 ⚙ 교사 설정 패널에 입력 (또는 DEFAULT_URL에 하드코딩)
 * 5. 시크릿 창에서 URL 접속 시 {"status":"ok","orders":[]} 가 보이면 정상 배포된 것
 */

var SHEET_NAME = '음료주문';
var HEADERS = ['제출시각', '이름', '주문내역', '합계', '요청사항'];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet_();

    sheet.appendRow([
      new Date().toLocaleString('ko-KR'),
      data.name || '',
      data.items || '',
      data.total || '',
      data.note || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet_();
    var lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonOutput_({ status: 'ok', orders: [] });
    }

    var limit = 50;
    var numRows = Math.min(lastRow - 1, limit);
    var startRow = lastRow - numRows + 1;
    var values = sheet.getRange(startRow, 1, numRows, HEADERS.length).getValues();

    var orders = values.map(function (row) {
      return {
        time: row[0],
        name: row[1],
        items: row[2],
        total: row[3],
        note: row[4]
      };
    }).reverse();

    return jsonOutput_({ status: 'ok', orders: orders });
  } catch (err) {
    return jsonOutput_({ status: 'error', message: err.message });
  }
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    var h = sheet.getRange(1, 1, 1, HEADERS.length);
    h.setBackground('#8B5E3C');
    h.setFontColor('#FFFFFF');
    h.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
