/**
 * クイズショート自動投稿（Google Apps Script）
 *
 * 1時間ごとに実行され、次のことを行う：
 *  1. GitHub の queue.json に載っている未投稿の動画を、古い順に1本だけ YouTube へ公開投稿する
 *  2. 投稿結果と全動画の再生数を GitHub の status.json に書き込む（Claude はこれを読む）
 *
 * 必要な設定：
 *  - サービス「YouTube Data API v3」（識別子 YouTube）… appsscript.json で追加済み
 *  - スクリプト プロパティ GITHUB_TOKEN … このリポジトリだけに Contents の読み書き権限を持つトークン
 */

const OWNER = 'Tomoya0824';
const REPO = 'kanji-quiz-shorts';
const REPO_RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/main/';
const MAX_UPLOADS_PER_DAY = 3;          // 安全のための上限（日本時間で1日あたり）
const STATS_INTERVAL_HOURS = 3;         // 再生数を書き込む間隔

/** 時間主導トリガー（1時間ごと）で実行する本体。 */
function uploadNext() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;      // 前回の実行がまだ動いていたら何もしない
  const props = PropertiesService.getScriptProperties();
  let changed = false;
  try {
    const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const todayCount = Object.values(uploaded).filter(u => u.date === today && u.at).length;

    if (todayCount < MAX_UPLOADS_PER_DAY) {
      const queue = fetchJson_(REPO_RAW + 'queue.json');
      const next = (queue.items || [])
        .filter(it => !uploaded[it.nnn])
        .sort((a, b) => a.nnn.localeCompare(b.nnn))[0];
      if (next) {
        const blob = UrlFetchApp.fetch(REPO_RAW + next.video_path + '?t=' + Date.now())
          .getBlob().setName(next.nnn + '.mp4').setContentType('video/mp4');
        const resource = {
          snippet: {
            title: next.title,
            description: next.description,
            tags: next.tags || [],
            categoryId: '27',
            defaultLanguage: 'ja',
            defaultAudioLanguage: 'ja',
          },
          status: {
            privacyStatus: next.privacy || 'public',
            selfDeclaredMadeForKids: false,
            embeddable: true,
            publicStatsViewable: true,
          },
        };
        const res = YouTube.Videos.insert(resource, 'snippet,status', blob, { notifySubscribers: true });
        uploaded[next.nnn] = { id: res.id, date: today, at: new Date().toISOString() };
        props.setProperty('uploaded', JSON.stringify(uploaded));
        props.deleteProperty('last_error');
        changed = true;
      }
    }
  } catch (e) {
    props.setProperty('last_error', new Date().toISOString() + ' ' + String(e));
    changed = true;
  } finally {
    lock.releaseLock();
  }

  const last = Number(props.getProperty('last_status_push') || 0);
  if (changed || Date.now() - last > STATS_INTERVAL_HOURS * 3600 * 1000) {
    pushStatus();
  }
}

/** 投稿結果と再生数を GitHub の status.json に書き込む。手動実行で動作確認にも使う。 */
function pushStatus() {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');

  // Apps Script 以外（Zapier）で投稿した動画も含めて、queue.json の already_uploaded からIDを集める
  let extra = [];
  try {
    const queue = fetchJson_(REPO_RAW + 'queue.json');
    extra = (queue.already_uploaded || []).map(u => u.id);
  } catch (e) { /* queue が読めなくても続行 */ }

  const ids = Array.from(new Set(Object.values(uploaded).map(u => u.id).concat(extra)));
  const stats = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = YouTube.Videos.list('statistics', { id: ids.slice(i, i + 50).join(',') });
    (r.items || []).forEach(v => {
      stats[v.id] = {
        views: Number(v.statistics.viewCount || 0),
        likes: Number(v.statistics.likeCount || 0),
        comments: Number(v.statistics.commentCount || 0),
      };
    });
  }
  const status = {
    updated: new Date().toISOString(),
    last_error: props.getProperty('last_error') || null,
    uploaded: uploaded,
    stats: stats,
  };
  githubPut_('status.json', JSON.stringify(status, null, 2), 'Apps Script: 投稿結果と再生数を更新');
  props.setProperty('last_status_push', String(Date.now()));
}

/** 最初に1回だけ手動で実行：1時間ごとのトリガーを作る（作り直しても安全）。 */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'uploadNext')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('uploadNext').timeBased().everyHours(1).create();
  YouTube.Channels.list('snippet', { mine: true });
  UrlFetchApp.fetch(REPO_RAW + 'README.md');
}

/** すでに Zapier で投稿した動画を記録に登録しておく（二重投稿防止）。 */
function registerExisting() {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');
  const queue = fetchJson_(REPO_RAW + 'queue.json');
  (queue.already_uploaded || []).forEach(u => {
    if (!uploaded[u.nnn]) uploaded[u.nnn] = { id: u.id, date: u.date, at: null };
  });
  props.setProperty('uploaded', JSON.stringify(uploaded));
}

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
