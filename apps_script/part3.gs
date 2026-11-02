/** 動作確認用：ブラウザで開くと status と同じ内容を表示する。 */
function doGet() {
  const props = PropertiesService.getScriptProperties();
  return ContentService.createTextOutput(JSON.stringify({
    last_error: props.getProperty('last_error') || null,
    uploaded: JSON.parse(props.getProperty('uploaded') || '{}'),
  })).setMimeType(ContentService.MimeType.JSON);
}

// ---------- helpers ----------
function fetchJson_(url) {
  return JSON.parse(UrlFetchApp.fetch(url + '?t=' + Date.now()).getContentText());
}

function githubPut_(path, content, message) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN が未設定です');
  const url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path;
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  const cur = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  const sha = cur.getResponseCode() === 200 ? JSON.parse(cur.getContentText()).sha : undefined;
  const body = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  const res = UrlFetchApp.fetch(url, {
    method: 'put', headers: headers, contentType: 'application/json',
    payload: JSON.stringify(body), muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('GitHub への書き込みに失敗: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  }
}
