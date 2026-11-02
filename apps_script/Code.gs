/**
 * クイズショート自動投稿（Google Apps Script）
 *
 * GitHub の queue.json に載っている動画を、古い順に1回1本ずつ YouTube へ公開投稿する。
 * 投稿済みの記録と再生数は Webアプリ（doGet）で JSON として返す（Claude が読む）。
 *
 * 必要な設定：エディタ左の「サービス」から「YouTube Data API v3」を追加（識別子 YouTube）。
 */

const REPO_RAW = 'https://raw.githubusercontent.com/Tomoya0824/kanji-quiz-shorts/main/';
const MAX_UPLOADS_PER_DAY = 3;   // 安全のための上限（日本時間で1日あたり）

/** 時間主導トリガー（1時間ごと）で実行する本体。 */
function uploadNext() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;           // 前回の実行がまだ動いていたら何もしない
  try {
    const props = PropertiesService.getScriptProperties();
    const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');

    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const todayCount = Object.values(uploaded).filter(u => u.date === today).length;
    if (todayCount >= MAX_UPLOADS_PER_DAY) return;

    const queue = fetchJson_(REPO_RAW + 'queue.json');
    const next = (queue.items || [])
      .filter(it => !uploaded[it.nnn])
      .sort((a, b) => a.nnn.localeCompare(b.nnn))[0];
    if (!next) return;

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
  } catch (e) {
    PropertiesService.getScriptProperties()
      .setProperty('last_error', new Date().toISOString() + ' ' + String(e));
  } finally {
    lock.releaseLock();
  }
}

/** Webアプリ：投稿済み一覧と再生数を JSON で返す（読み取り専用）。 */
function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');

  // ?ids=a,b,c で、Apps Script 以外で投稿した動画の再生数もまとめて取れる
  const extra = ((e && e.parameter && e.parameter.ids) || '').split(',')
    .map(s => s.trim()).filter(s => /^[\w-]{6,20}$/.test(s));
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
  const out = {
    now: new Date().toISOString(),
    last_error: props.getProperty('last_error') || null,
    uploaded: uploaded,
    stats: stats,
  };
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 最初に1回だけ手動で実行：1時間ごとのトリガーを作る。 */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'uploadNext')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('uploadNext').timeBased().everyHours(1).create();
  // 承認ダイアログを出すために YouTube と外部通信を一度呼んでおく
  YouTube.Channels.list('snippet', { mine: true });
  UrlFetchApp.fetch(REPO_RAW + 'README.md');
}

/** すでに Zapier で投稿した動画を記録に登録しておく（二重投稿防止）。最初に1回だけ実行。 */
function registerExisting() {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');
  const queue = fetchJson_(REPO_RAW + 'queue.json');
  (queue.already_uploaded || []).forEach(u => {
    if (!uploaded[u.nnn]) uploaded[u.nnn] = { id: u.id, date: u.date, at: null };
  });
  props.setProperty('uploaded', JSON.stringify(uploaded));
}

function fetchJson_(url) {
  return JSON.parse(UrlFetchApp.fetch(url + '?t=' + Date.now()).getContentText());
}
