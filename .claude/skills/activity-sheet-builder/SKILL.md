---
name: activity-sheet-builder
description: >
  HTML 활동지(기획서, 설문지, 성찰일지, 체크리스트 등)를 만들고 Google Sheets에 자동 저장되도록 연결하는 전체 절차. 학생들이 브라우저에서 작성하면 데이터가 구글 스프레드시트에 자동 기록됨. TXT 파일 저장과 이미지 첨부도 지원.
  사용자가 "활동지", "기획서 폼", "구글 시트 연동", "학생 제출 폼", "활동 기록지", "설문 페이지" 등을 언급하거나, HTML 폼과 스프레드시트를 연결하고 싶다고 할 때 이 스킬을 적용한다.
---

# 활동지 ↔ 구글 시트 연결 스킬

단일 HTML 파일로 활동지를 만들고, Google Apps Script를 백엔드 삼아 구글 스프레드시트에 자동 저장하는 표준 절차입니다.

## 전체 흐름

```
[HTML 활동지] → fetch POST (no-cors) → [Apps Script] → [Google Sheets]
     ↓
[TXT 파일 다운로드] (동시)
     ↓
[이미지 첨부 시] → base64 → [Google Drive 저장 후 링크를 시트에 기록]
```

---

## 1단계: 활동지 유형 파악

사용자에게 확인할 것:
- **폼 섹션 목록**: 어떤 항목을 입력받나? (팀명, 문제정의, 일정 등)
- **필수 항목**: 저장 전 반드시 입력해야 할 필드
- **이미지 첨부 필요 여부**: 사진/스케치/캡처 등을 첨부할 일이 있는가
- **디자인 매칭**: 기존 발표자료(프레젠테이션)와 같은 디자인을 써야 하는가

---

## 2단계: HTML 활동지 구조

`references/html-patterns.md`를 읽어 세부 구현 패턴을 참조한다.

### 핵심 구조 원칙

```html
<!-- 1. 헤더: 제목 + 저장 버튼 -->
<!-- 2. 설정 패널 (기본 hidden): Apps Script URL 입력 — 교사 전용 -->
<!-- 3. 폼 섹션들: 카드 형태로 구분 -->
<!-- 4. 액션 바 (하단 고정): [저장하기] [초기화] + 임시저장 상태 -->
<!-- 5. 토스트 알림 + 가이드 모달 -->
```

### 보안 필수 사항

- `innerHTML`에 사용자 입력값 절대 금지 → `textContent`, `createElement` 사용
- 인라인 이벤트 핸들러(`onclick` 등) 금지 → `addEventListener` 사용
- `<img onerror>` fallback만 예외 허용

### localStorage 임시저장 패턴

```javascript
var DRAFT_KEY = 'draft_활동지명';
var draftTimer = null;

function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 1500);
}
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(getFormData()));
  // 상태 레이블 업데이트
}
// 모든 input/textarea/select에 이벤트 등록
document.querySelectorAll('input, textarea, select').forEach(function(el) {
  el.addEventListener('input', scheduleDraft);
  el.addEventListener('change', scheduleDraft);
});
```

---

## 3단계: Google Apps Script 설정

### apps-script.js 파일 위치 규칙

- **같은 과목의 활동지가 여러 개**이면 → `apps-script.js`를 **과목 폴더**에 하나만 생성
  - 예: `정보/apps-script.js` (정보 과목의 모든 활동지 공용)
  - 각 활동지 HTML의 `getFormData()`에 `source: '식별자'` 필드를 추가해 시트 탭을 분기
- **독립 활동지**(과목 무관 또는 단독)이면 → 해당 폴더에 개별 생성

> **과목 공용 패턴 (multi-source)**은 `references/sheets-integration.md`의 "과목 공용 multi-source 패턴" 섹션을 읽는다.

### Apps Script 기본 템플릿

`references/apps-script-template.md`를 읽어 전체 코드를 참조한다.

> **완전 연동 패턴** (설정 패널 CSS/HTML/JS + apps-script.js 파일 생성 규칙)은 `references/sheets-integration.md`를 읽는다.

**핵심 코드 구조:**

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("시트명") || ss.insertSheet("시트명");

    // 첫 행: 헤더 자동 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["제출시각", "항목1", "항목2", /* ... */]);
    }

    // 데이터 행 추가
    sheet.appendRow([
      new Date().toLocaleString("ko-KR"),
      data.field1 || "",
      data.field2 || "",
      /* ... */
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({status:"ok"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({status:"error", message:err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 배포 설정 (중요)

1. Apps Script 편집기 → **배포 → 새 배포**
2. 유형: **웹 앱**
3. 실행 계정: **나 (스크립트 소유자)**
4. 액세스 권한: **모든 사용자 (익명 포함)** ← 반드시 이것으로 설정
5. 배포 후 URL 복사 (`https://script.google.com/macros/s/.../exec` 형태)

> 학교 Google Workspace 계정은 URL이 `/a/macros/도메인/...` 형태이므로 액세스 권한을 반드시 확인한다.

---

## 4단계: fetch 연결 (no-cors 패턴)

```javascript
var DEFAULT_URL = 'https://script.google.com/macros/s/.../exec'; // 배포 URL 하드코딩

document.getElementById('btnSave').addEventListener('click', function() {
  if (!validate()) { showToast('필수 항목을 모두 입력해 주세요.', 'error'); return; }
  var data = getFormData();
  var btn = this;
  btn.disabled = true;

  // TXT 먼저 다운로드
  downloadTxt(data);

  // 구글 시트 전송
  var url = localStorage.getItem(URL_KEY) || DEFAULT_URL;
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',          // 응답을 읽을 수 없지만 요청은 전송됨
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function() {
    showToast('저장 완료!', 'success', 4000);
  }).catch(function(err) {
    showToast('파일은 저장됐습니다. 시트 오류: ' + err.message, 'error');
  }).finally(function() {
    btn.disabled = false;
  });
});
```

**no-cors 주의사항:**
- 응답을 읽을 수 없으므로 성공/실패를 확인할 수 없다 → 낙관적 UI
- 요청 자체는 정상 전송됨; 시트에 데이터가 없으면 배포 설정(액세스 권한)을 먼저 확인

---

## 5단계: TXT 파일 저장

```javascript
function buildTxt(data) {
  var lines = [];
  var now = new Date().toLocaleString('ko-KR');
  lines.push('═══════════════════════════════');
  lines.push('  활동지 제목');
  lines.push('  작성일시: ' + now);
  lines.push('═══════════════════════════════');
  lines.push('');
  lines.push('【 섹션1 】');
  lines.push('항목명: ' + (data.field1 || ''));
  // ... 각 섹션별로 구성
  return lines.join('\n');
}

function downloadTxt(data) {
  var blob = new Blob([buildTxt(data)], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '활동지_' + (data.teamName || '') + '_' + new Date().toLocaleDateString('ko-KR') + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
```

---

## 6단계: 이미지 첨부 (선택)

이미지가 필요할 때는 `references/image-upload.md`를 읽어 구현한다.

**요약:**
1. HTML: `<input type="file" accept="image/*">` + 미리보기 `<img>`
2. JS: `FileReader.readAsDataURL()` → base64 문자열로 변환
3. POST body에 포함: `{ ...data, imageBase64: "data:image/png;base64,..." }`
4. Apps Script에서 base64 디코딩 → Google Drive 저장 → 링크를 시트에 기록

---

## 7단계: clasp로 Apps Script 자동 배포 (선택)

clasp(Google 공식 CLI)를 사용하면 로컬 파일 수정 후 터미널 2줄로 배포할 수 있다.

### 최초 설정 (과목당 1회)

```bash
# 1. clasp 설치 (전역)
npm install -g @google/clasp

# 2. Google 계정 로그인
clasp login

# 3. Apps Script API 활성화 (브라우저)
# https://script.google.com/home/usersettings → Google Apps Script API 켬

# 4. 과목 폴더에서 기존 스크립트 연결
cd 과목폴더/          # 예: E:/presentation/정보
clasp clone <스크립트ID>   # Apps Script 편집기 → ⚙ 프로젝트 설정 → 스크립트 ID

# 5. .claspignore 생성 (apps-script.js만 푸시되도록)
# 내용:
# **
# !apps-script.js
# !appsscript.json

# 6. 배포 ID 확인 (현재 활성 배포)
clasp deployments
```

### 활동지 추가/수정 후 배포 (2줄)

```bash
cd 과목폴더/
clasp push
clasp deploy --deploymentId <배포ID> --description "설명"
```

- `clasp push` — 로컬 `apps-script.js`를 Apps Script에 업로드
- `clasp deploy` — 기존 배포를 새 버전으로 갱신 (**URL 동일 유지**)

### 주의사항

- 재배포 시 URL은 바뀌지 않으므로 HTML `DEFAULT_URL` 수정 불필요
- `clasp clone` 시 생성되는 `Code.js`는 삭제해도 됨 (`apps-script.js`가 대신함)
- `.clasp.json`, `.claspignore`는 과목 폴더 루트에 위치

---

## 8단계: URL 숨기기 (학생 접근 방지)

URL을 학생이 변경하지 못하도록 설정 패널을 숨긴다:

```html
<div id="settingsPanel" style="display:none;">
  <!-- URL 입력 영역 -->
</div>
```

URL은 JS 상수(`DEFAULT_URL`)로 하드코딩하고, `localStorage`에 저장된 값이 있으면 그것을 우선 사용한다 (교사가 바꿀 수 있는 여지 유지).

---

## 체크리스트

- [ ] Apps Script 배포 → 액세스 권한 "모든 사용자(익명 포함)" 확인
- [ ] 배포 URL을 HTML의 `DEFAULT_URL`에 하드코딩
- [ ] 시트가 비어 있어도 OK (첫 POST 시 헤더 자동 생성)
- [ ] 필수 항목 유효성 검사 구현
- [ ] localStorage 임시저장 작동 확인
- [ ] 이미지 포함 시 Apps Script에 `saveImage()` 함수 추가
