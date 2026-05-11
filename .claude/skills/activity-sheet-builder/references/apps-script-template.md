# Google Apps Script 템플릿

## 기본 템플릿 (이미지 없음)

스프레드시트의 확장 프로그램 → Apps Script에 아래 코드를 붙여넣고 배포한다.

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("활동지") || ss.insertSheet("활동지");

    // 첫 실행 시 헤더 자동 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "제출시각", "학번/이름",
        // ↓ 활동지 항목에 맞게 수정
        "항목1", "항목2", "항목3"
      ]);
    }

    sheet.appendRow([
      new Date().toLocaleString("ko-KR"),
      data.studentId || "",
      data.field1 || "",
      data.field2 || "",
      data.field3 || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 이미지 포함 템플릿

이미지를 Google Drive에 저장하고 링크를 시트에 기록한다.

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("활동지") || ss.insertSheet("활동지");

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "제출시각", "학번/이름",
        "항목1", "항목2",
        "이미지"   // =IMAGE() 수식으로 셀 안에 미리보기 표시
      ]);
    }

    // 이미지 처리
    var imageUrl = "";
    if (data.imageBase64) {
      imageUrl = saveImageToDrive(data.imageBase64, data.studentId || "unknown");
    }

    sheet.appendRow([
      new Date().toLocaleString("ko-KR"),
      data.studentId || "",
      data.field1 || "",
      data.field2 || "",
      imageUrl ? '=IMAGE("' + imageUrl + '")' : ""  // 셀 안에 이미지 미리보기
    ]);

    // 이미지가 있으면 해당 행 높이를 키워 미리보기가 보이도록
    if (imageUrl) {
      sheet.setRowHeight(sheet.getLastRow(), 150);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * base64 이미지를 Google Drive에 저장하고 공유 URL 반환
 * @param {string} base64String - "data:image/png;base64,..." 형태
 * @param {string} prefix - 파일명 앞에 붙일 구분자 (학번 등)
 */
function saveImageToDrive(base64String, prefix) {
  // data URL에서 타입과 데이터 분리
  var match = base64String.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return "";

  var mimeType = match[1];          // 예: "image/png"
  var base64Data = match[2];
  var ext = mimeType.split("/")[1]; // 예: "png"

  // Blob 생성
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    prefix + "_" + new Date().getTime() + "." + ext
  );

  // Drive에 저장 (루트 폴더 또는 지정 폴더)
  // 특정 폴더 사용 시: DriveApp.getFolderById("폴더ID").createFile(blob)
  var file = DriveApp.createFile(blob);

  // 공유 설정: 링크가 있는 모든 사용자가 볼 수 있도록
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}
```

---

## 배포 절차

1. Apps Script 편집기 상단 오른쪽 → **배포 → 새 배포**
2. 유형 선택: **웹 앱**
3. 설명: (선택) 예) `활동지 v1`
4. 다음 사용자로 실행: **나**
5. 액세스 권한: **모든 사용자 (익명 포함)** ← 반드시 이것
6. **배포** 클릭 → URL 복사

### 학교 Google Workspace 계정 주의사항

- 배포 URL이 `https://script.google.com/a/macros/도메인/...` 형태일 수 있음
- 이 경우 액세스 권한이 "기관 내 사용자" 로 제한될 수 있으므로 반드시 "모든 사용자(익명 포함)"로 설정
- 배포 후 시크릿 창에서 GET 요청으로 접속해 실제 응답 확인 권장:
  ```
  https://script.google.com/macros/s/.../exec?test=1
  ```
  → `{"status":"error","message":"Cannot read ..."}` 응답이 오면 배포 성공

---

## 수정 후 재배포

코드를 수정하면 **반드시 새 버전으로 재배포**해야 반영된다.

1. 배포 → 배포 관리 → 연필 아이콘
2. 버전: **새 버전**
3. 배포 → URL은 동일하게 유지됨

---

## 자주 쓰는 Apps Script 패턴

### 여러 시트에 나눠 저장 (반별 분리)

```javascript
// data.className 값에 따라 시트 분기
var sheetName = data.className || "공통";
var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
```

### 중복 제출 방지 (학번 기준)

```javascript
var lastRow = sheet.getLastRow();
if (lastRow > 1) {
  var ids = sheet.getRange(2, 2, lastRow - 1).getValues().flat();
  if (ids.indexOf(data.studentId) !== -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "duplicate" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 이메일 알림 (제출 시 교사에게 알림)

```javascript
MailApp.sendEmail({
  to: "teacher@school.kr",
  subject: "[활동지 제출] " + data.studentId,
  body: JSON.stringify(data, null, 2)
});
```
