(function () {
  'use strict';

  var D = window.TRAINING_DATA;
  var MONTHS = D.months;
  var BY_KEY = {};
  MONTHS.forEach(function (m) { BY_KEY[m.key] = m; });

  var STORE_KEY = 'kaigoTraining.v1';
  var STATUSES = ['予定', '実施済', '延期', '中止'];
  var PLACES = ['事業所内', 'オンライン', '外部研修', '資料回覧'];
  var JOBS = ['訪問介護員', 'サービス提供責任者', '管理者', '事務員', 'その他'];
  var EMPLOYMENTS = ['常勤', '非常勤', '登録ヘルパー'];
  var COMMITTEE_TYPES = ['虐待防止検討委員会', '感染対策委員会', '合同開催'];
  var DRILL_TYPES = ['BCP（自然災害）', 'BCP（感染症）', '感染症まん延防止訓練'];
  var NEWHIRE_ITEMS = [
    '法人理念・運営規程・就業規則、守秘義務誓約書の提出',
    '高齢者虐待防止・身体的拘束等の適正化（必須）',
    '感染症の予防及びまん延防止',
    '業務継続計画（緊急連絡網・安否確認）',
    'ハラスメント対策と相談窓口',
    '記録の書き方・訪問介護計画と手順書の読み方',
    '同行訪問',
    '同行訪問'
  ];
  // 法定研修の区分と、該当する月
  var LEGAL_GROUPS = [
    { id: 'abuse', name: '高齢者虐待防止・身体的拘束等の適正化', months: ['05', '12'] },
    { id: 'infection', name: '感染症の予防及びまん延防止', months: ['06', '11'] },
    { id: 'bcp', name: '業務継続計画（BCP）', months: ['07', '11'] }
  ];

  // ---------- 保存データ ----------
  function defaultState() {
    return {
      version: 1,
      settings: { office: '', startYear: 2026, manager: '', abuseOfficer: '', infectionOfficer: '', passMark: 7 },
      staff: [],
      sessions: {},
      results: [],
      committees: [],
      drills: [],
      newHire: {},
      log: []
    };
  }
  var S = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        var d = defaultState();
        Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
        Object.keys(d.settings).forEach(function (k) { if (s.settings[k] === undefined) s.settings[k] = d.settings[k]; });
        return s;
      }
    } catch (e) { console.error(e); }
    return defaultState();
  }
  function save(msg) {
    if (msg) {
      S.log.unshift({ at: nowISO(), msg: msg });
      if (S.log.length > 500) S.log.length = 500;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      S.lastSavedAt = nowISO();
    } catch (e) {
      alert('保存できませんでした。ブラウザの設定（プライベートモードなど）を確認してください。\n' + e.message);
    }
  }

  // ---------- ユーティリティ ----------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function today() { return nowISO().slice(0, 10); }
  function wa(d) {
    if (!d) return '';
    var p = d.slice(0, 10).split('-');
    var y = +p[0], era = y >= 2019 ? '令和' : '平成', ey = y >= 2019 ? y - 2018 : y - 1988;
    return era + (ey === 1 ? '元' : ey) + '年' + (+p[1]) + '月' + (+p[2]) + '日';
  }
  function waDateTime(iso) { return iso ? wa(iso) + ' ' + iso.slice(11, 16) : ''; }
  function reiwa(y) { return '令和' + (y - 2018) + '年度'; }
  function fyStart() { return S.settings.startYear + '-04-01'; }
  function fyEnd() { return (S.settings.startYear + 1) + '-03-31'; }
  function inFY(d) { return d && d >= fyStart() && d <= fyEnd(); }
  function monthOf(key) { return BY_KEY[key].month; }
  function calYear(key) { return +key >= 4 ? S.settings.startYear : S.settings.startYear + 1; }
  function minutesBetween(a, b) {
    if (!a || !b) return '';
    var x = a.split(':'), y = b.split(':');
    var m = (+y[0] * 60 + +y[1]) - (+x[0] * 60 + +x[1]);
    return m > 0 ? m : '';
  }
  function toast(t) {
    var el = document.getElementById('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function opt(list, cur) {
    return list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function formData(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.name.slice(-2) === '[]') {
          var k = el.name.slice(0, -2);
          o[k] = o[k] || [];
          if (el.checked) o[k].push(el.value);
        } else o[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) o[el.name] = el.value;
      } else o[el.name] = el.value.trim();
    });
    return o;
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        c = c == null ? '' : String(c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
  }

  // ---------- 職員・受講状況の判定 ----------
  function staffById(id) { return S.staff.filter(function (s) { return s.id === id; })[0]; }
  function staffName(id) { var s = staffById(id); return s ? s.name : '（削除された職員）'; }
  function activeOn(s, date) {
    if (!date) return !s.retireDate;
    if (s.hireDate && s.hireDate > date) return false;
    if (s.retireDate && s.retireDate < date) return false;
    return true;
  }
  function session(key) {
    if (!S.sessions[key]) {
      var m = BY_KEY[key];
      S.sessions[key] = {
        status: '予定', date: '', start: '', end: '', place: [], instructorName: '', instructorTitle: m.instructor,
        summary: m.content, qa: '', issues: '', note: '', recordDate: '', recorder: '', managerCheckDate: '', managerName: '',
        materials: ['研修資料', '確認テスト'], materialsOther: '', absentMethod: ['資料回覧＋確認テスト'], absentOther: '',
        attendees: {}, absentees: {}, paperScores: {}
      };
    }
    return S.sessions[key];
  }
  function sessionView(key) { return S.sessions[key] || session(key); }
  function targets(key) {
    var ss = sessionView(key);
    return S.staff.filter(function (s) { return activeOn(s, ss.date); });
  }
  function officialResults(staffId, key) {
    return S.results.filter(function (r) { return r.staffId === staffId && r.month === key && r.kind !== '練習'; })
      .sort(function (a, b) { return a.takenAt < b.takenAt ? -1 : 1; });
  }
  // 記録用の点数：アプリで受けた最初の正式受験の点数（なければ紙テストの手入力）
  function scoreOf(staffId, key) {
    var rs = officialResults(staffId, key);
    if (rs.length) return { score: rs[0].score, source: 'アプリ', at: rs[0].takenAt, count: rs.length };
    var p = sessionView(key).paperScores[staffId];
    if (p !== undefined && p !== '') return { score: +p, source: '紙', at: '' };
    return null;
  }
  function attendance(staffId, key) {
    var ss = sessionView(key);
    if (ss.attendees[staffId]) return ss.attendees[staffId];
    var rs = officialResults(staffId, key);
    if (rs.length) return rs[0].kind === '回覧' ? '欠席' : '参加';
    return '';
  }
  // 受講状況：'参加' / '回覧済' / '回覧中'（欠席・未提出） / '未' / '対象外' / ''（研修未実施）
  function completion(staffId, key) {
    var ss = sessionView(key);
    var s = staffById(staffId);
    if (ss.status !== '実施済') return '';
    if (!s || !activeOn(s, ss.date)) return '対象外';
    var a = attendance(staffId, key);
    if (a === '対象外') return '対象外';
    if (a === '参加') return '参加';
    if (a === '欠席') {
      var ab = ss.absentees[staffId] || {};
      return (scoreOf(staffId, key) || ab.submittedDate) ? '回覧済' : '回覧中';
    }
    return '未';
  }
  function sessionStats(key) {
    var ss = sessionView(key), t = targets(key);
    var present = 0, absent = 0, done = 0, scores = [], follow = [];
    t.forEach(function (s) {
      var a = attendance(s.id, key);
      if (a === '対象外') return;
      if (a === '参加') present++;
      if (a === '欠席') absent++;
      var c = completion(s.id, key);
      if (c === '参加' || c === '回覧済') done++;
      var sc = scoreOf(s.id, key);
      if (sc) { scores.push(sc.score); if (sc.score < S.settings.passMark) follow.push(s.name); }
    });
    var target = t.filter(function (s) { return attendance(s.id, key) !== '対象外'; }).length;
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length * 10) / 10 : '';
    return { target: target, present: present, absent: absent, done: done, avg: avg, scored: scores.length, follow: follow, status: ss.status };
  }

  // ---------- 画面 ----------
  var app = document.getElementById('app');
  var routes = [];
  function route(re, fn) { routes.push([re, fn]); }

  function render() {
    var h = location.hash.replace(/^#/, '') || '/';
    document.getElementById('office-name').textContent = (S.settings.office || '事業所名未設定') + '　' + reiwa(S.settings.startYear);
    document.getElementById('nav').classList.remove('open');
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      var p = a.getAttribute('href').slice(1);
      a.classList.toggle('active', p === '/' ? h === '/' : h.indexOf(p) === 0 || (p === '/materials' && /^\/(m|test)\//.test(h)) || (p === '/records' && h.indexOf('/record/') === 0));
    });
    for (var i = 0; i < routes.length; i++) {
      var m = h.match(routes[i][0]);
      if (m) { app.innerHTML = routes[i][1].apply(null, m.slice(1)); window.scrollTo(0, 0); bind(); return; }
    }
    app.innerHTML = '<p>ページが見つかりません。<a href="#/">ホームへ</a></p>';
  }
  window.addEventListener('hashchange', render);
  document.getElementById('nav-toggle').onclick = function () { document.getElementById('nav').classList.toggle('open'); };

  // 描画後に呼ぶ処理（フォームのイベントなど）
  var afterRender = [];
  function later(fn) { afterRender.push(fn); }
  function bind() { var a = afterRender; afterRender = []; a.forEach(function (fn) { fn(); }); }
  function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

  function statusBadge(st) {
    var cls = st === '実施済' ? 'ok' : st === '予定' ? 'gray' : 'warn';
    return '<span class="badge ' + cls + '">' + esc(st) + '</span>';
  }
  function legalBadge(m) { return m.legal ? '<span class="badge legal">★法定</span>' : ''; }
  function noStaffNotice() {
    return S.staff.length ? '' : '<div class="alert">職員が登録されていません。まず<a href="#/staff">職員</a>を登録してください。</div>';
  }

  // ホーム
  route(/^\/$/, function () {
    var curMonth = pad(new Date().getMonth() + 1);
    var cur = BY_KEY[curMonth];
    var done = MONTHS.filter(function (m) { return sessionView(m.key).status === '実施済'; });
    var legal = MONTHS.filter(function (m) { return m.legal; });
    var legalDone = legal.filter(function (m) { return sessionView(m.key).status === '実施済'; });
    var pending = [], follow = [];
    done.forEach(function (m) {
      S.staff.forEach(function (s) {
        var c = completion(s.id, m.key);
        if (c === '未' || c === '回覧中') pending.push(m.month + '：' + s.name + '（' + (c === '未' ? '出欠未記録' : '確認テスト未提出') + '）');
        var sc = scoreOf(s.id, m.key);
        if (sc && sc.score < S.settings.passMark && c !== '対象外') follow.push(m.month + '：' + s.name + '（' + sc.score + '点）');
      });
    });
    var issues = complianceChecks().filter(function (c) { return !c.ok && c.due; });
    return '<h1>ホーム</h1>' + noStaffNotice() +
      (S.settings.office ? '' : '<div class="notice">はじめに<a href="#/settings">設定</a>で事業所名・年度・担当者を入力してください。</div>') +
      '<div class="stats">' +
      '<div class="stat"><div class="muted">実施済の研修</div><div class="v">' + done.length + ' / 12</div></div>' +
      '<div class="stat"><div class="muted">法定研修（★）</div><div class="v">' + legalDone.length + ' / ' + legal.length + '</div></div>' +
      '<div class="stat"><div class="muted">登録職員（在籍）</div><div class="v">' + S.staff.filter(function (s) { return !s.retireDate; }).length + '名</div></div>' +
      '<div class="stat"><div class="muted">要フォロー（' + (S.settings.passMark - 1) + '点以下）</div><div class="v">' + follow.length + '件</div></div>' +
      '</div>' +
      '<h2>今月の研修</h2>' +
      '<div class="card"><div class="m"><b>' + esc(cur.month) + '</b>　' + esc(cur.theme) + legalBadge(cur) + statusBadge(sessionView(cur.key).status) + '</div>' +
      '<p class="muted">' + esc(cur.content) + '</p>' +
      '<div class="actions"><a class="btn" href="#/m/' + cur.key + '">研修資料を読む</a><a class="btn" href="#/test/' + cur.key + '">確認テストを受ける</a><a class="btn sub" href="#/record/' + cur.key + '">実施記録を書く</a></div></div>' +
      (issues.length ? '<h2>運営指導に向けて対応が必要なこと</h2><div class="card"><ul>' + issues.map(function (c) { return '<li>' + esc(c.name) + '：' + esc(c.detail) + '</li>'; }).join('') + '</ul><a href="#/inspection">運営指導対応ページへ</a></div>' : '') +
      (pending.length ? '<h2>受講が完了していない職員</h2><div class="card"><ul>' + pending.slice(0, 30).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' + (pending.length > 30 ? '<p class="muted">ほか' + (pending.length - 30) + '件</p>' : '') + '</div>' : '') +
      (follow.length ? '<h2>個別フォローが必要な職員</h2><div class="card"><p class="muted">解説を使って個別に説明し、実施記録の「理解度確認の結果」に反映してください。</p><ul>' + follow.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '');
  });

  // 研修資料一覧
  route(/^\/materials$/, function () {
    return '<h1>研修資料・確認テスト</h1><p class="muted">★は法定研修（運営基準で年1回以上の実施が義務）です。研修資料を読んだ後、確認テスト（10問・' + S.settings.passMark + '点以上が目安）を受けてください。</p>' +
      '<div class="grid">' + MONTHS.map(function (m) {
        return '<a class="card month-card" href="#/m/' + m.key + '"><div><span class="m">' + esc(m.month) + '</span>' + legalBadge(m) + statusBadge(sessionView(m.key).status) + '</div>' +
          '<div><b>' + esc(m.theme) + '</b></div><div class="muted small">' + esc(m.content) + '</div></a>';
      }).join('') + '</div>';
  });

  // 研修資料
  function materialBody(m) {
    return m.blocks.map(function (b) {
      if (b.type === 'h') return '<h3>' + esc(b.text) + '</h3>';
      if (b.type === 'p') return '<p>' + esc(b.text) + '</p>';
      return '<div class="table-wrap"><table>' + (b.head ? '<tr>' + b.head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>' : '') +
        b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
    }).join('');
  }
  function refsList(refs) {
    return '<ul>' + refs.map(function (r) {
      return '<li>' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' : esc(r.name)) + '<span class="muted small">（' + esc(r.org) + '）' + esc(r.use) + '</span></li>';
    }).join('') + '</ul>';
  }

  route(/^\/m\/(\d\d)$/, function (key) {
    var m = BY_KEY[key];
    var body = materialBody(m);
    var review = m.review.length ? '<h2>振り返りクイズ（研修中の確認用・記録されません）</h2>' + m.review.map(function (r, i) {
      return '<div class="q" id="rv' + i + '"><div class="qt">' + (i + 1) + '. ' + esc(r.q) + '</div><div class="opts">' +
        ['○', '×'].map(function (o) { return '<button class="opt ox" data-rv="' + i + '" data-v="' + o + '">' + o + '</button>'; }).join('') +
        '</div><div class="explain" hidden></div></div>';
    }).join('') : '';
    var refs = m.refs.length ? '<h2>参考資料（公的機関）</h2>' + refsList(m.refs) : '';
    later(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-rv]'), function (b) {
        b.onclick = function () {
          var i = +b.dataset.rv, r = m.review[i], box = document.getElementById('rv' + i);
          var ok = b.dataset.v === r.a;
          box.classList.remove('right', 'wrong'); box.classList.add(ok ? 'right' : 'wrong');
          var ex = box.querySelector('.explain'); ex.hidden = false;
          ex.textContent = (ok ? '正解！ ' : '不正解。') + '答えは「' + r.a + '」' + (r.note ? '：' + r.note : '');
        };
      });
    });
    return '<div class="actions"><a class="btn sub" href="#/materials">← 一覧へ</a></div>' +
      '<div class="material card"><h1>' + esc(m.title) + legalBadge(m) + '</h1>' +
      '<p class="muted">講師：' + esc(m.instructor) + '　区分：' + esc(m.category) + '</p>' +
      (m.aim ? '<div class="aim"><b>ねらい：</b>' + esc(m.aim) + '</div>' : '') + body + review + refs +
      '<div class="actions"><a class="btn" href="#/test/' + key + '">確認テストを受ける</a><a class="btn sub" href="#/print/material/' + key + '">研修資料を印刷</a><a class="btn sub" href="#/print/test/' + key + '">問題用紙を印刷</a><a class="btn sub" href="#/record/' + key + '">実施記録</a></div></div>';
  });

  // ---------- 資料集（Excelの資料） ----------
  route(/^\/library$/, function () {
    return '<h1>資料集</h1><p class="muted">Excel「研修計画・研修資料・記録様式」と「研修確認テスト集」に入っている資料です。</p>' +
      '<h2>研修資料（4月〜3月）</h2><div class="table-wrap"><table><tr><th>月</th><th>研修テーマ</th><th>区分</th><th>講師</th><th></th></tr>' +
      MONTHS.map(function (m) {
        return '<tr><td>' + esc(m.month) + '</td><td>' + esc(m.theme) + legalBadge(m) + '</td><td>' + esc(m.category) + '</td><td>' + esc(m.instructor) + '</td>' +
          '<td style="white-space:nowrap"><a href="#/m/' + m.key + '">読む</a>　<a href="#/print/material/' + m.key + '">印刷</a></td></tr>';
      }).join('') + '</table></div>' +
      '<div class="actions"><a class="btn sub" href="#/print/materials">研修資料12か月分をまとめて印刷</a></div>' +
      '<h2>計画・参考資料・様式</h2><div class="grid">' +
      printLink('#/library/plan', '年間研修計画', '月別のテーマ・区分・主な内容・講師、委員会・訓練の年間計画') +
      printLink('#/library/refs', '参考資料（公的資料リンク）', '研修テーマ別の厚生労働省などの資料') +
      printLink('#/print/blank', '記録様式（白紙）', '様式1〜5を白紙で印刷（手書きで記録する場合）') +
      printLink('#/library/rules', '記入のルール・テストの使い方', '記録を書くときの決まり、確認テストの使い方') +
      '</div>' +
      '<h2>確認テスト集</h2><div class="grid">' +
      printLink('#/print/tests', '問題用紙（12か月分）', '解答なし。紙で実施する場合・欠席者への配布用') +
      printLink('#/print/answers', '解答・解説（管理者・講師用）', '全12回分の正解と解説') +
      '<a class="card month-card" href="docs/' + encodeURIComponent('確認テスト_解答一覧') + '.xlsx" download><b>解答Excel（採点表つき）</b><div class="muted small">正解一覧・解答解説・振り返りクイズ解答・自動採点表</div></a>' +
      '</div>';
  });

  route(/^\/library\/plan$/, function () {
    return '<div class="actions"><a class="btn sub" href="#/library">← 資料集へ</a><a class="btn sub" href="#/print/plan">実施状況つきで印刷</a></div>' +
      '<h1>' + reiwa(S.settings.startYear) + '　年間研修計画</h1><p class="muted">★は法定研修（運営基準で年1回以上の実施が義務）。</p>' +
      '<div class="table-wrap"><table><tr><th>月</th><th>研修テーマ</th><th>区分</th><th>主な内容</th><th>講師</th></tr>' +
      MONTHS.map(function (m) {
        return '<tr><td>' + esc(m.month) + '</td><td><a href="#/m/' + m.key + '">' + (m.legal ? '★' : '') + esc(m.theme) + '</a></td><td>' + esc(m.category) + '</td><td>' + esc(m.content) + '</td><td>' + esc(m.instructor) + '</td></tr>';
      }).join('') + '</table></div>' +
      '<h2>委員会・訓練の年間計画</h2><div class="table-wrap"><table><tr><th>項目</th><th>頻度の基準</th><th>実施予定月</th><th>担当</th><th>記録</th></tr>' +
      D.committees.map(function (c) {
        return '<tr><td>' + esc(c.item) + '</td><td>' + esc(c.freq) + '</td><td>' + esc(c.months) + '</td><td>' + esc(c.owner) + '</td><td>' + esc(c.record) + '</td></tr>';
      }).join('') + '</table></div>';
  });

  route(/^\/library\/refs$/, function () {
    return '<div class="actions"><a class="btn sub" href="#/library">← 資料集へ</a></div><h1>参考資料（公的機関の資料）</h1>' +
      '<p class="muted">研修資料の根拠や、より詳しく説明したいときに使ってください。リンク先はExcel作成時（2026年10月21日）に確認したものです。</p>' +
      MONTHS.filter(function (m) { return m.refs.length; }).map(function (m) {
        return '<h3>' + esc(m.month) + '　' + (m.legal ? '★' : '') + esc(m.theme) + '</h3>' + refsList(m.refs);
      }).join('');
  });

  route(/^\/library\/rules$/, function () {
    return '<div class="actions"><a class="btn sub" href="#/library">← 資料集へ</a></div><h1>記入のルール・テストの使い方</h1>' +
      '<div class="card"><h3>記入のルール</h3><ul>' +
      '<li>日付・参加者・時間は、実際に行った内容をそのまま記入します。</li>' +
      '<li>計画月と実施月がずれた場合は、備考欄に理由を書きます（例：計画5月、10月に実施）。</li>' +
      '<li>後日まとめて記録を作成した場合は、実施日とは別に「記録作成日」を記入します。</li>' +
      '<li>欠席者は資料を読んで確認テストを提出してもらい、様式2の回覧確認表に日付と署名を残します。</li>' +
      '<li>複数のテーマを同じ日に行う場合は、テーマごとに様式1を作成します。</li>' +
      '</ul></div>' +
      '<div class="card"><h3>確認テストの使い方</h3><ul>' +
      '<li>全10問（○×5問、三択5問）、1問1点の10点満点です。目安は' + S.settings.passMark + '点以上で、それより低い職員には解説を使って個別に説明します。</li>' +
      '<li>採点後、点数を様式2（参加者名簿）の「確認テスト点数」欄に記録します（アプリで受験した場合は自動で入ります）。</li>' +
      '<li>欠席者にも資料とあわせて配布し、提出日を様式2の回覧確認表に記録します。</li>' +
      '<li>研修資料の末尾にある5問の振り返りクイズは研修中の振り返り用、確認テストは理解度確認・記録用として使い分けます。</li>' +
      '</ul></div>';
  });

  function paperMaterial(key, withAnswers) {
    var m = BY_KEY[key];
    return '<div class="paper material"><h1>' + esc(m.title) + '</h1>' +
      (m.aim ? '<p><b>ねらい：</b>' + esc(m.aim) + '</p>' : '') + materialBody(m) +
      (m.review.length ? '<h3>確認テスト（○か×で答えてください）</h3>' + m.review.map(function (r, i) {
        return '<p>' + (i + 1) + '. ' + esc(r.q) + (withAnswers ? '　<b>【' + r.a + '】</b>' + (r.note ? esc('（' + r.note + '）') : '') : '　（　　）') + '</p>';
      }).join('') : '') +
      (m.refs.length ? '<h3>参考資料（公的機関）</h3>' + m.refs.map(function (r) { return '<p class="small">・' + esc(r.name) + '（' + esc(r.org) + '）</p>'; }).join('') : '') + '</div>';
  }
  function materialToggle(href, ans) {
    return '<div class="actions"><a class="btn sub" href="' + href + '">' + (ans ? '解答なしで印刷（配布用）' : '解答つきで印刷（講師用）') + '</a></div>';
  }
  route(/^\/print\/material\/(\d\d)(\/ans)?$/, function (key, ans) {
    return paperShell('研修資料', materialToggle('#/print/material/' + key + (ans ? '' : '/ans'), !!ans) + paperMaterial(key, !!ans));
  });
  route(/^\/print\/materials(\/ans)?$/, function (ans) {
    return paperShell('研修資料（12か月分）', materialToggle('#/print/materials' + (ans ? '' : '/ans'), !!ans) + MONTHS.map(function (m) { return paperMaterial(m.key, !!ans); }).join(''));
  });

  route(/^\/print\/blank$/, function () {
    var rows = function (n, cols) { var h = ''; for (var i = 1; i <= n; i++) h += '<tr class="sign"><td class="c">' + i + '</td>' + new Array(cols).join('<td></td>') + '</tr>'; return h; };
    var f1 = '<div class="paper"><h1>様式1　研修実施記録</h1><p>事業所名：</p><table>' +
      trow('研修名', '') + trow('区分', box(['法定研修（虐待防止・感染症・BCP）', '事業所研修', '新規採用時研修'], [])) +
      trow('実施日時', '令和　年　月　日（　）　　時　　分 〜 　　時　　分（　　分間）') + trow('実施場所・方法', box(PLACES, [])) +
      trow('講師', '氏名：　　　　　　　　職名：') + trow('参加者数', '　　名（様式2 参加者名簿のとおり）／対象者　　名') +
      trow('使用資料', '□ 研修資料（　　月）　□ 確認テスト　□ その他：') + trow('研修内容の要旨', '<div style="height:5em"></div>') +
      trow('質疑・意見交換の内容', '<div style="height:4em"></div>') + trow('理解度確認の結果', '確認テスト平均　　点／満点　　点、要フォロー者　　名') +
      trow('欠席者への対応', '□ 資料回覧＋確認テスト　□ 伝達研修（　月　日）　□ その他：') + trow('今後の課題・次回への反映', '<div style="height:3em"></div>') +
      trow('備考（計画との差異など）', '<div style="height:2em"></div>') + trow('記録作成日・記録者', '令和　年　月　日　　記録者：') + trow('管理者確認', '確認日：　　　　　　　署名：') + '</table></div>';
    var f2 = '<div class="paper"><h1>様式2　参加者名簿・欠席者回覧確認表</h1><table>' + trow('研修名', '') + trow('実施日', '令和　年　月　日') + '</table>' +
      '<h3>参加者名簿（当日参加者は本人署名）</h3><table class="list"><tr><th class="c">No.</th><th>氏名</th><th>職種・雇用形態</th><th style="width:28%">署名</th><th class="c">確認テスト点数</th></tr>' + rows(15, 5) + '</table>' +
      '<h3>欠席者 資料回覧確認表（資料を読み、確認テストを提出した日に署名）</h3><table class="list"><tr><th class="c">No.</th><th>氏名</th><th>資料受領日</th><th>確認テスト提出日</th><th class="c">点数</th><th>本人署名</th><th>管理者確認</th></tr>' + rows(8, 7) + '</table></div>';
    return paperShell('記録様式（白紙）', f1 + f2 + paperCommittee({}) + paperDrill({ types: [] }) + paperNewHire({ id: '', name: '' }));
  });

  // ---------- 説明書 ----------
  function md(text) {
    var out = [], lines = text.split('\n'), i = 0, n = 0;
    var inline = function (s) { return esc(s); };
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      var h = l.match(/^(#{2,3}) (.*)$/);
      if (h) {
        if (h[1] === '##') { n++; out.push('<h2 id="sec' + n + '">' + inline(h[2]) + '</h2>'); } else out.push('<h3>' + inline(h[2]) + '</h3>');
        i++; continue;
      }
      if (/^\|/.test(l)) {
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) { return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        out.push('<div class="table-wrap"><table><tr>' + cells(rows[0]).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>' +
          rows.slice(2).map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>');
        continue;
      }
      var lm = l.match(/^(\d+\.|-) /);
      if (lm) {
        var ordered = lm[1] !== '-', items = [];
        while (i < lines.length && /^(\d+\.|-) /.test(lines[i])) { items.push(lines[i].replace(/^(\d+\.|-) /, '')); i++; }
        var tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</' + tag + '>');
        continue;
      }
      out.push('<p>' + inline(l) + '</p>'); i++;
    }
    return out.join('');
  }
  route(/^\/manual$/, function () {
    var text = window.MANUAL_TEXT || '';
    var heads = text.split('\n').filter(function (l) { return /^## /.test(l); }).map(function (l) { return l.slice(3); });
    later(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-sec]'), function (a) {
        a.onclick = function (e) { e.preventDefault(); document.getElementById('sec' + a.dataset.sec).scrollIntoView({ behavior: 'smooth' }); };
      });
      document.getElementById('mprint').onclick = function () { window.print(); };
    });
    return '<div class="actions"><button id="mprint" class="sub">説明書を印刷・PDF保存</button></div>' +
      '<div class="material card manual"><h1>訪問介護 研修アプリ 説明書</h1>' +
      '<div class="notice no-print"><b>目次</b><ol>' + heads.map(function (t, i) { return '<li><a href="#" data-sec="' + (i + 1) + '">' + esc(t) + '</a></li>'; }).join('') + '</ol></div>' +
      md(text) + '</div>';
  });

  // 確認テスト
  var T = null;
  route(/^\/test\/(\d\d)$/, function (key) {
    var m = BY_KEY[key];
    if (!T || T.key !== key) T = { key: key, step: 'start', answers: [] };
    var head = '<div class="actions"><a class="btn sub" href="#/m/' + key + '">← 研修資料へ</a></div><h1>確認テスト　' + esc(m.month) + '　' + esc(m.theme) + '</h1>';
    if (T.step === 'start') {
      var active = S.staff.filter(function (s) { return !s.retireDate; });
      later(function () {
        var f = document.getElementById('tstart');
        f.staff.onchange = function () {
          var a = attendance(f.staff.value, key);
          if (a === '欠席') f.kind.value = '回覧';
          else if (a === '参加') f.kind.value = '参加';
          var prev = officialResults(f.staff.value, key);
          document.getElementById('prev').textContent = prev.length ? 'この職員は ' + waDateTime(prev[0].takenAt) + ' に受験済み（' + prev[0].score + '点）です。記録には最初の点数が使われます。' : '';
        };
        f.onsubmit = function (e) {
          e.preventDefault();
          var d = formData(f);
          if (!d.staff) { alert('氏名を選んでください'); return; }
          T = { key: key, step: 'q', staffId: d.staff, kind: d.kind, answers: [], startedAt: nowISO() };
          render();
        };
      });
      return head + noStaffNotice() + '<div class="card"><p>全10問（○×5問、三択5問）、1問1点の10点満点です。目安は' + S.settings.passMark + '点以上です。</p>' +
        '<form id="tstart"><label>氏名</label><select name="staff"><option value="">選択してください</option>' +
        active.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select>' +
        '<p id="prev" class="muted small"></p>' +
        '<label>受験の種類</label><select name="kind"><option value="参加">研修に参加した（研修後の確認テスト）</option><option value="回覧">研修を欠席した（資料を読んで提出）</option><option value="練習">練習（記録に残さない）</option></select>' +
        '<div class="actions"><button type="submit">テストを始める</button></div></form></div>';
    }
    var qs = m.test;
    var done = T.step === 'result';
    later(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-q]'), function (b) {
        b.onclick = function () {
          if (T.step !== 'q') return;
          T.answers[+b.dataset.q] = b.dataset.v;
          Array.prototype.forEach.call(document.querySelectorAll('[data-q="' + b.dataset.q + '"]'), function (x) { x.classList.toggle('sel', x === b); });
          var n = T.answers.filter(Boolean).length;
          var sb = document.getElementById('submit');
          sb.disabled = n < qs.length; sb.textContent = n < qs.length ? 'あと' + (qs.length - n) + '問' : '採点する';
        };
      });
      var sb = document.getElementById('submit');
      if (sb) sb.onclick = function () {
        var score = qs.filter(function (q, i) { return T.answers[i] === q.answer; }).length;
        T.step = 'result'; T.score = score;
        if (T.kind !== '練習') {
          S.results.push({ id: uid(), staffId: T.staffId, month: key, kind: T.kind, score: score, answers: T.answers.slice(), startedAt: T.startedAt, takenAt: nowISO() });
          if (T.kind === '回覧') {
            var ss = session(key);
            ss.attendees[T.staffId] = ss.attendees[T.staffId] || '欠席';
            var ab = ss.absentees[T.staffId] = ss.absentees[T.staffId] || {};
            if (!ab.submittedDate) ab.submittedDate = today();
          } else {
            var ss2 = session(key);
            if (!ss2.attendees[T.staffId]) ss2.attendees[T.staffId] = '参加';
          }
          save('確認テスト受験：' + m.month + ' ' + staffName(T.staffId) + ' ' + score + '点（' + T.kind + '）');
        }
        render();
      };
    });
    var res = '';
    if (done) {
      var pass = T.score >= S.settings.passMark;
      res = '<div class="card" style="text-align:center"><div>' + esc(staffName(T.staffId)) + 'さんの結果</div><div class="score">' + T.score + ' / 10点</div>' +
        '<div>' + (pass ? '<span class="badge ok">合格ライン到達</span>' : '<span class="badge warn">もう一度資料を確認しましょう（管理者・講師から個別に説明します）</span>') + '</div>' +
        '<p class="muted small">' + (T.kind === '練習' ? '練習のため記録されていません。' : '受験日時：' + waDateTime(nowISO()) + '　記録しました。') + '</p>' +
        '<div class="actions" style="justify-content:center"><button class="sub" id="again">別の職員が受ける</button><a class="btn sub" href="#/m/' + key + '">研修資料を見直す</a></div></div>';
      later(function () { document.getElementById('again').onclick = function () { T = null; render(); }; });
    }
    return head + '<p>氏名：<b>' + esc(staffName(T.staffId)) + '</b>　種類：' + esc(T.kind) + '</p>' + res +
      qs.map(function (q, i) {
        var a = T.answers[i];
        var cls = done ? (a === q.answer ? ' right' : ' wrong') : '';
        var choices = q.type === 'ox' ? ['○', '×'].map(function (o) {
          return '<button class="opt ox' + (a === o ? ' sel' : '') + '" data-q="' + i + '" data-v="' + o + '"' + (done ? ' disabled' : '') + '>' + o + '</button>';
        }).join('') : q.choices.map(function (c) {
          return '<button class="opt' + (a === c.k ? ' sel' : '') + '" data-q="' + i + '" data-v="' + c.k + '"' + (done ? ' disabled' : '') + '>' + c.k + '　' + esc(c.t) + '</button>';
        }).join('');
        return '<div class="q' + cls + '"><div class="qt">問' + q.no + '　' + esc(q.q) + '</div><div class="opts">' + choices + '</div>' +
          (done ? '<div class="explain"><b>' + (a === q.answer ? '正解' : '不正解（あなたの解答：' + esc(a) + '）') + '　正解：' + esc(q.answer) + '</b><br>' + esc(q.explain) + '</div>' : '') + '</div>';
      }).join('') +
      (done ? '' : '<div class="actions"><button id="submit" disabled>あと' + qs.length + '問</button></div>');
  });

  // 研修実施記録一覧
  route(/^\/records$/, function () {
    return '<h1>研修実施記録</h1><p class="muted">研修ごとに、実施日・講師・参加者・欠席者への対応を記録します（様式1・様式2）。実際に行った内容をそのまま記入してください。</p>' + noStaffNotice() +
      '<div class="table-wrap"><table><tr><th>月</th><th>研修テーマ</th><th>状況</th><th>実施日</th><th class="c">参加/対象</th><th class="c">受講完了</th><th class="c">平均点</th><th class="c">要フォロー</th><th></th></tr>' +
      MONTHS.map(function (m) {
        var ss = sessionView(m.key), st = sessionStats(m.key);
        return '<tr><td>' + esc(m.month) + '</td><td>' + esc(m.theme) + legalBadge(m) + '</td><td>' + statusBadge(ss.status) + '</td><td>' + esc(wa(ss.date)) + '</td>' +
          '<td class="c">' + (ss.status === '実施済' ? st.present + '/' + st.target : '') + '</td><td class="c">' + (ss.status === '実施済' ? st.done + '/' + st.target : '') + '</td>' +
          '<td class="c">' + st.avg + '</td><td class="c">' + (st.follow.length || '') + '</td><td><a href="#/record/' + m.key + '">記入</a>　<a href="#/print/record/' + m.key + '">印刷</a></td></tr>';
      }).join('') + '</table></div>';
  });

  // 研修実施記録（様式1・2）
  route(/^\/record\/(\d\d)$/, function (key) {
    var m = BY_KEY[key], ss = sessionView(key);
    var list = targets(key);
    var others = S.staff.filter(function (s) { return list.indexOf(s) < 0 && (ss.attendees[s.id] || officialResults(s.id, key).length); });
    list = list.concat(others);
    later(function () {
      var f = document.getElementById('rec');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f), s = session(key);
        ['status', 'date', 'start', 'end', 'instructorName', 'instructorTitle', 'summary', 'qa', 'issues', 'note', 'recordDate', 'recorder', 'managerCheckDate', 'managerName', 'materialsOther', 'absentOther'].forEach(function (k) { s[k] = d[k] || ''; });
        s.place = d.place || []; s.materials = d.materials || []; s.absentMethod = d.absentMethod || [];
        if (s.status === '実施済' && !s.date) { alert('実施済の場合は実施日を入力してください'); return; }
        if (s.status === '実施済' && !s.recordDate) s.recordDate = today();
        list.forEach(function (st) {
          var a = d['att_' + st.id];
          if (a) s.attendees[st.id] = a; else delete s.attendees[st.id];
          var ab = { receivedDate: d['rcv_' + st.id] || '', submittedDate: d['sub_' + st.id] || '', checked: d['chk_' + st.id] || '' };
          if (ab.receivedDate || ab.submittedDate || ab.checked) s.absentees[st.id] = ab; else delete s.absentees[st.id];
          var p = d['paper_' + st.id];
          if (p !== undefined) { if (p === '') delete s.paperScores[st.id]; else s.paperScores[st.id] = Math.max(0, Math.min(10, +p)); }
        });
        s.updatedAt = nowISO();
        save('研修実施記録を更新：' + m.month + ' ' + m.theme + '（' + s.status + '）');
        toast('保存しました');
        render();
      };
      document.getElementById('allpresent').onclick = function () {
        Array.prototype.forEach.call(f.querySelectorAll('select[name^="att_"]'), function (el) { if (!el.value) el.value = '参加'; });
      };
    });
    var st = sessionStats(key);
    var mins = minutesBetween(ss.start, ss.end);
    var checks = function (name, items, cur) {
      return '<div class="checks">' + items.map(function (v) { return '<label><input type="checkbox" name="' + name + '[]" value="' + esc(v) + '"' + (cur.indexOf(v) >= 0 ? ' checked' : '') + '>' + esc(v) + '</label>'; }).join('') + '</div>';
    };
    var rows = list.map(function (s) {
      var a = attendance(s.id, key), ab = ss.absentees[s.id] || {}, sc = scoreOf(s.id, key);
      var rs = officialResults(s.id, key);
      var paper = rs.length ? '<span title="アプリで受験">' + rs[0].score + '点</span>' + (rs.length > 1 ? '<span class="muted small">（再受験' + (rs.length - 1) + '回）</span>' : '') :
        '<input type="number" min="0" max="10" name="paper_' + s.id + '" value="' + esc(ss.paperScores[s.id] !== undefined ? ss.paperScores[s.id] : '') + '" placeholder="紙" style="width:4.5em">';
      return '<tr><td>' + esc(s.name) + '<div class="muted small">' + esc(s.job || '') + ' ' + esc(s.employment || '') + '</div></td>' +
        '<td><select name="att_' + s.id + '"><option value="">未記録</option>' + opt(['参加', '欠席', '対象外'], ss.attendees[s.id] || '') + '</select>' + (!ss.attendees[s.id] && a ? '<div class="muted small">テストより：' + a + '</div>' : '') + '</td>' +
        '<td>' + paper + (sc && sc.score < S.settings.passMark ? ' <span class="badge warn">要フォロー</span>' : '') + '</td>' +
        '<td><input type="date" name="rcv_' + s.id + '" value="' + esc(ab.receivedDate || '') + '"></td>' +
        '<td><input type="date" name="sub_' + s.id + '" value="' + esc(ab.submittedDate || '') + '"></td>' +
        '<td><input type="date" name="chk_' + s.id + '" value="' + esc(ab.checked || '') + '"></td></tr>';
    }).join('');
    return '<div class="actions"><a class="btn sub" href="#/records">← 一覧へ</a><a class="btn sub" href="#/print/record/' + key + '">様式1・2を印刷</a></div>' +
      '<h1>研修実施記録　' + esc(m.month) + '　' + esc(m.theme) + legalBadge(m) + '</h1>' + noStaffNotice() +
      '<form id="rec"><div class="card"><h3>様式1　研修実施記録</h3>' +
      '<div class="row"><div><label>状況</label><select name="status">' + opt(STATUSES, ss.status) + '</select></div>' +
      '<div><label>実施日</label><input type="date" name="date" value="' + esc(ss.date) + '" min="' + fyStart() + '" max="' + fyEnd() + '"></div>' +
      '<div><label>開始時刻</label><input type="time" name="start" value="' + esc(ss.start) + '"></div>' +
      '<div><label>終了時刻</label><input type="time" name="end" value="' + esc(ss.end) + '"></div></div>' +
      (mins ? '<p class="muted small">研修時間：' + mins + '分間</p>' : '') +
      '<label>実施場所・方法</label>' + checks('place', PLACES, ss.place) +
      '<div class="row"><div><label>講師 氏名</label><input type="text" name="instructorName" value="' + esc(ss.instructorName) + '"></div>' +
      '<div><label>講師 職名</label><input type="text" name="instructorTitle" value="' + esc(ss.instructorTitle) + '"></div></div>' +
      '<label>使用資料</label>' + checks('materials', ['研修資料', '確認テスト'], ss.materials) + '<input type="text" name="materialsOther" placeholder="その他の資料" value="' + esc(ss.materialsOther) + '">' +
      '<label>研修内容の要旨</label><textarea name="summary">' + esc(ss.summary) + '</textarea>' +
      '<label>質疑・意見交換の内容</label><textarea name="qa">' + esc(ss.qa) + '</textarea>' +
      '<label>欠席者への対応</label>' + checks('absentMethod', ['資料回覧＋確認テスト', '伝達研修'], ss.absentMethod) + '<input type="text" name="absentOther" placeholder="伝達研修の日付・その他" value="' + esc(ss.absentOther) + '">' +
      '<label>今後の課題・次回への反映</label><textarea name="issues">' + esc(ss.issues) + '</textarea>' +
      '<label>備考（計画との差異など）</label><textarea name="note" placeholder="例：計画5月、10月に実施（理由：…）">' + esc(ss.note) + '</textarea>' +
      '<div class="row"><div><label>記録作成日</label><input type="date" name="recordDate" value="' + esc(ss.recordDate) + '"></div>' +
      '<div><label>記録者</label><input type="text" name="recorder" value="' + esc(ss.recorder) + '"></div>' +
      '<div><label>管理者確認日</label><input type="date" name="managerCheckDate" value="' + esc(ss.managerCheckDate) + '"></div>' +
      '<div><label>管理者名</label><input type="text" name="managerName" value="' + esc(ss.managerName || S.settings.manager) + '"></div></div>' +
      '<p class="muted small">理解度確認の結果（自動集計）：確認テスト平均 ' + (st.avg === '' ? '—' : st.avg) + '点／10点、受験 ' + st.scored + '名、要フォロー ' + st.follow.length + '名' + (st.follow.length ? '（' + esc(st.follow.join('、')) + '）' : '') + '</p></div>' +
      '<div class="card"><h3>様式2　参加者名簿・欠席者回覧確認</h3>' +
      '<p class="muted small">対象者は実施日に在籍している職員です。アプリで受けた確認テストの点数は自動で入ります。紙で受けた場合は点数を入力してください。</p>' +
      '<div class="actions"><button type="button" class="sub" id="allpresent">未記録をすべて「参加」にする</button></div>' +
      '<div class="table-wrap"><table><tr><th>氏名</th><th>出欠</th><th>確認テスト</th><th>資料受領日<br><span class="small">（欠席者）</span></th><th>テスト提出日<br><span class="small">（欠席者）</span></th><th>管理者確認日<br><span class="small">（欠席者）</span></th></tr>' + rows + '</table></div></div>' +
      '<div class="actions"><button type="submit">保存する</button></div></form>' +
      (ss.updatedAt ? '<p class="muted small">最終更新：' + waDateTime(ss.updatedAt) + '</p>' : '');
  });

  // 委員会・訓練
  route(/^\/meetings$/, function () {
    var com = S.committees.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var dr = S.drills.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return '<h1>委員会・訓練</h1>' +
      '<h2>年間計画</h2><div class="table-wrap"><table><tr><th>項目</th><th>頻度の基準</th><th>予定月</th><th>担当</th><th>今年度の実施</th></tr>' +
      D.committees.map(function (c) {
        var recs = committeeRecordsFor(c.item);
        return '<tr><td>' + esc(c.item) + '</td><td>' + esc(c.freq) + '</td><td>' + esc(c.months) + '</td><td>' + esc(c.owner) + '</td><td>' + (recs === null ? '<span class="muted small">' + esc(c.record) + '</span>' : recs.length ? recs.map(function (r) { return esc(wa(r.date)); }).join('<br>') : '<span class="badge warn">未実施</span>') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<h2>委員会議事録（様式3）</h2><div class="actions"><a class="btn" href="#/committee/new">議事録を追加</a></div>' +
      (com.length ? '<div class="table-wrap"><table><tr><th>開催日</th><th>委員会</th><th>議題</th><th></th></tr>' + com.map(function (c) {
        return '<tr><td>' + esc(wa(c.date)) + '</td><td>' + esc(c.type) + '</td><td>' + esc(c.agenda1) + '</td><td><a href="#/committee/' + c.id + '">編集</a>　<a href="#/print/committee/' + c.id + '">印刷</a></td></tr>';
      }).join('') + '</table></div>' : '<p class="muted">まだ記録がありません。</p>') +
      '<h2>訓練記録（様式4）</h2><div class="actions"><a class="btn" href="#/drill/new">訓練記録を追加</a></div>' +
      (dr.length ? '<div class="table-wrap"><table><tr><th>実施日</th><th>訓練の種類</th><th>想定した状況</th><th></th></tr>' + dr.map(function (c) {
        return '<tr><td>' + esc(wa(c.date)) + '</td><td>' + esc((c.types || []).join('、')) + '</td><td>' + esc(c.scenario) + '</td><td><a href="#/drill/' + c.id + '">編集</a>　<a href="#/print/drill/' + c.id + '">印刷</a></td></tr>';
      }).join('') + '</table></div>' : '<p class="muted">まだ記録がありません。</p>');
  });
  function committeeRecordsFor(item) {
    var fy = function (r) { return inFY(r.date); };
    if (item === '虐待防止検討委員会' || item === '感染対策委員会') return S.committees.filter(function (c) { return fy(c) && (c.type === item || c.type === '合同開催'); });
    var m = item.match(/^(BCP訓練（(自然災害|感染症)）|感染症まん延防止訓練)$/);
    if (m) {
      var t = item === '感染症まん延防止訓練' ? item : 'BCP（' + m[2] + '）';
      return S.drills.filter(function (d) { return fy(d) && (d.types || []).indexOf(t) >= 0; });
    }
    return null;
  }

  function recordForm(kind, id) {
    var isC = kind === 'committee';
    var list = isC ? S.committees : S.drills;
    var r = id === 'new' ? null : list.filter(function (x) { return x.id === id; })[0];
    if (id !== 'new' && !r) return '<p>記録が見つかりません。</p>';
    r = r || (isC ? { type: COMMITTEE_TYPES[0], method: '対面', guidelineChange: '変更なし', noticeMethod: [] } : { types: [], method: '机上訓練（シミュレーション）', reflect: '反映不要' });
    later(function () {
      var f = document.getElementById('mf');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f);
        if (!d.date) { alert('日付を入力してください'); return; }
        if (!isC && !(d.types || []).length) { alert('訓練の種類を選んでください'); return; }
        var target = id === 'new' ? { id: uid(), createdAt: nowISO() } : r;
        Object.keys(d).forEach(function (k) { target[k] = d[k]; });
        target.updatedAt = nowISO();
        if (id === 'new') list.push(target);
        save((isC ? '委員会議事録' : '訓練記録') + (id === 'new' ? 'を追加：' : 'を更新：') + wa(d.date) + ' ' + (isC ? d.type : d.types.join('・')));
        toast('保存しました'); go('/meetings');
      };
      var del = document.getElementById('del');
      if (del) del.onclick = function () {
        if (!confirm('この記録を削除しますか？')) return;
        list.splice(list.indexOf(r), 1);
        save((isC ? '委員会議事録' : '訓練記録') + 'を削除：' + wa(r.date));
        go('/meetings');
      };
    });
    var t = function (name, label, ph) { return '<label>' + label + '</label><textarea name="' + name + '" placeholder="' + esc(ph || '') + '">' + esc(r[name] || '') + '</textarea>'; };
    var i = function (name, label, type) { return '<div><label>' + label + '</label><input type="' + (type || 'text') + '" name="' + name + '" value="' + esc(r[name] || '') + '"></div>'; };
    var radios = function (name, items) { return '<div class="checks">' + items.map(function (v) { return '<label><input type="radio" name="' + name + '" value="' + esc(v) + '"' + (r[name] === v ? ' checked' : '') + '>' + esc(v) + '</label>'; }).join('') + '</div>'; };
    var checks = function (name, items) { var cur = r[name] || []; return '<div class="checks">' + items.map(function (v) { return '<label><input type="checkbox" name="' + name + '[]" value="' + esc(v) + '"' + (cur.indexOf(v) >= 0 ? ' checked' : '') + '>' + esc(v) + '</label>'; }).join('') + '</div>'; };
    var body = isC ?
      '<h1>委員会議事録（様式3）</h1><label>委員会名</label>' + radios('type', COMMITTEE_TYPES) +
      '<div class="row">' + i('date', '開催日', 'date') + i('start', '開始時刻', 'time') + i('end', '終了時刻', 'time') + '</div>' +
      '<label>開催方法</label>' + radios('method', ['対面', 'オンライン']) +
      '<div class="row">' + i('chair', '委員長') + i('officer', '担当者') + i('others', 'その他の出席者') + '</div>' +
      t('report', '前回からの報告事項', 'ヒヤリハット・苦情・感染症発生状況など') +
      t('agenda1', '議題1', '虐待防止：セルフチェック結果、職員のストレス・労働環境、身体的拘束等の有無 ／ 感染対策：流行状況、防護具・消毒液の在庫、職員の体調管理') +
      t('agenda2', '議題2') + t('decision', '検討結果・決定事項') +
      '<label>指針・マニュアルの見直し</label>' + radios('guidelineChange', ['変更なし', '変更あり']) + '<input type="text" name="guidelineDetail" placeholder="変更内容" value="' + esc(r.guidelineDetail || '') + '">' +
      '<label>職員への周知方法</label>' + checks('noticeMethod', ['会議で説明', '回覧', '掲示']) +
      '<div class="row">' + i('noticeDate', '周知日', 'date') + i('next', '次回開催予定（例：令和9年6月頃）') + i('recorder', '記録者') + i('managerName', '管理者') + '</div>'
      :
      '<h1>訓練記録（様式4）</h1><label>訓練の種類（複数選択可）</label>' + checks('types', DRILL_TYPES) +
      '<div class="row">' + i('date', '実施日', 'date') + i('start', '開始時刻', 'time') + i('end', '終了時刻', 'time') + i('participants', '参加者数（名）', 'number') + '</div>' +
      '<label>実施方法</label>' + radios('method', ['机上訓練（シミュレーション）', '実地訓練', '組み合わせ']) +
      t('scenario', '想定した状況', '例：震度6弱の地震が平日10時に発生／職員1名が感染症で欠勤') +
      t('flow', '訓練の流れ', '1.\n2.\n3.') + t('confirmed', '確認できたこと') + t('problems', '課題・うまくいかなかったこと') +
      '<label>BCP・マニュアルへの反映</label>' + radios('reflect', ['反映不要', '反映あり']) + '<input type="text" name="reflectDetail" placeholder="反映内容・反映日" value="' + esc(r.reflectDetail || '') + '">' +
      '<div class="row">' + i('recorder', '記録者') + i('managerName', '管理者') + '</div>';
    return '<div class="actions"><a class="btn sub" href="#/meetings">← 戻る</a></div><form id="mf" class="card">' + body +
      '<div class="actions"><button type="submit">保存する</button>' + (id !== 'new' ? '<button type="button" class="danger" id="del">削除</button>' : '') + '</div></form>';
  }
  route(/^\/committee\/(\w+)$/, function (id) { return recordForm('committee', id); });
  route(/^\/drill\/(\w+)$/, function (id) { return recordForm('drill', id); });

  // 新規採用時研修
  route(/^\/newhire$/, function () {
    var list = S.staff.slice().sort(function (a, b) { return (b.hireDate || '') < (a.hireDate || '') ? -1 : 1; });
    return '<h1>新規採用時研修（様式5）</h1><p class="muted">虐待防止研修は新規採用時にも実施が必要です。採用者ごとに記録してください。</p>' + noStaffNotice() +
      (list.length ? '<div class="table-wrap"><table><tr><th>氏名</th><th>入職日</th><th class="c">実施済項目</th><th>単独訪問開始日</th><th></th></tr>' + list.map(function (s) {
        var nh = S.newHire[s.id] || { items: [] };
        var n = (nh.items || []).filter(function (x) { return x && x.date; }).length;
        return '<tr><td>' + esc(s.name) + (s.retireDate ? ' <span class="badge gray">退職</span>' : '') + '</td><td>' + esc(wa(s.hireDate)) + '</td><td class="c">' + n + ' / ' + NEWHIRE_ITEMS.length + (nh.items && nh.items[1] && nh.items[1].date ? '' : ' <span class="badge warn">虐待防止 未</span>') + '</td><td>' + esc(wa(nh.soloStart)) + '</td><td><a href="#/newhire/' + s.id + '">記入</a>　<a href="#/print/newhire/' + s.id + '">印刷</a></td></tr>';
      }).join('') + '</table></div>' : '');
  });
  route(/^\/newhire\/(\w+)$/, function (id) {
    var s = staffById(id);
    if (!s) return '<p>職員が見つかりません。</p>';
    var nh = S.newHire[id] || { items: [] };
    later(function () {
      var f = document.getElementById('nh');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f);
        var o = { items: NEWHIRE_ITEMS.map(function (_, i) { return { date: d['d' + i], instructor: d['t' + i], client: d['c' + i] || '' }; }), soloStart: d.soloStart, sekiCheck: d.sekiCheck, managerCheck: d.managerCheck, updatedAt: nowISO() };
        S.newHire[id] = o;
        save('新規採用時研修記録を更新：' + s.name);
        toast('保存しました'); go('/newhire');
      };
    });
    return '<div class="actions"><a class="btn sub" href="#/newhire">← 戻る</a><a class="btn sub" href="#/print/newhire/' + id + '">様式5を印刷</a></div>' +
      '<h1>新規採用時研修記録　' + esc(s.name) + '</h1><p class="muted">入職日：' + esc(wa(s.hireDate) || '未登録') + '　資格：' + esc(s.qualification || '') + '</p>' +
      '<form id="nh" class="card"><div class="table-wrap"><table><tr><th>No.</th><th>研修内容</th><th>実施日</th><th>講師</th></tr>' +
      NEWHIRE_ITEMS.map(function (t, i) {
        var it = (nh.items || [])[i] || {};
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(t) + (i >= 6 ? '<input type="text" name="c' + i + '" placeholder="利用者名" value="' + esc(it.client || '') + '">' : '') + '</td>' +
          '<td><input type="date" name="d' + i + '" value="' + esc(it.date || '') + '"></td><td><input type="text" name="t' + i + '" value="' + esc(it.instructor || '') + '"></td></tr>';
      }).join('') + '</table></div>' +
      '<div class="row"><div><label>単独訪問の開始日</label><input type="date" name="soloStart" value="' + esc(nh.soloStart || '') + '"></div>' +
      '<div><label>サービス提供責任者確認</label><input type="text" name="sekiCheck" value="' + esc(nh.sekiCheck || '') + '"></div>' +
      '<div><label>管理者確認</label><input type="text" name="managerCheck" value="' + esc(nh.managerCheck || '') + '"></div></div>' +
      '<div class="actions"><button type="submit">保存する</button></div></form>';
  });

  // 職員
  route(/^\/staff$/, function () {
    later(function () {
      var f = document.getElementById('sf');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f);
        if (!d.name) { alert('氏名を入力してください'); return; }
        var s = { id: uid(), name: d.name, job: d.job, employment: d.employment, hireDate: d.hireDate, qualification: d.qualification, retireDate: '' };
        S.staff.push(s);
        save('職員を登録：' + s.name);
        toast('登録しました'); render();
      };
    });
    var list = S.staff.slice().sort(function (a, b) { return (a.retireDate ? 1 : 0) - (b.retireDate ? 1 : 0); });
    return '<h1>職員</h1>' +
      '<form id="sf" class="card"><h3>職員を登録</h3><div class="row">' +
      '<div><label>氏名</label><input type="text" name="name"></div>' +
      '<div><label>職種</label><select name="job">' + opt(JOBS, '訪問介護員') + '</select></div>' +
      '<div><label>雇用形態</label><select name="employment">' + opt(EMPLOYMENTS, '常勤') + '</select></div>' +
      '<div><label>入職日</label><input type="date" name="hireDate"></div>' +
      '<div><label>資格</label><input type="text" name="qualification" placeholder="介護福祉士、初任者研修 など"></div></div>' +
      '<div class="actions"><button type="submit">登録</button></div></form>' +
      (list.length ? '<div class="table-wrap"><table><tr><th>氏名</th><th>職種・雇用形態</th><th>入職日</th><th>資格</th><th>退職日</th><th></th></tr>' + list.map(function (s) {
        return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.job) + '・' + esc(s.employment) + '</td><td>' + esc(wa(s.hireDate)) + '</td><td>' + esc(s.qualification) + '</td><td>' + esc(wa(s.retireDate)) + '</td>' +
          '<td><a href="#/staff/' + s.id + '">編集</a>　<a href="#/print/person/' + s.id + '">受講履歴</a></td></tr>';
      }).join('') + '</table></div>' : '');
  });
  route(/^\/staff\/(\w+)$/, function (id) {
    var s = staffById(id);
    if (!s) return '<p>職員が見つかりません。</p>';
    later(function () {
      var f = document.getElementById('se');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f);
        if (!d.name) { alert('氏名を入力してください'); return; }
        ['name', 'job', 'employment', 'hireDate', 'qualification', 'retireDate'].forEach(function (k) { s[k] = d[k]; });
        save('職員情報を更新：' + s.name);
        toast('保存しました'); go('/staff');
      };
      document.getElementById('del').onclick = function () {
        if (!confirm(s.name + 'さんを削除しますか？\n受講記録の氏名も表示できなくなります。退職者は削除せず「退職日」を入力してください（運営指導では過去の受講記録も確認されます）。')) return;
        S.staff.splice(S.staff.indexOf(s), 1);
        save('職員を削除：' + s.name);
        go('/staff');
      };
    });
    return '<div class="actions"><a class="btn sub" href="#/staff">← 戻る</a></div><form id="se" class="card"><h1>職員情報の編集</h1><div class="row">' +
      '<div><label>氏名</label><input type="text" name="name" value="' + esc(s.name) + '"></div>' +
      '<div><label>職種</label><select name="job">' + opt(JOBS, s.job) + '</select></div>' +
      '<div><label>雇用形態</label><select name="employment">' + opt(EMPLOYMENTS, s.employment) + '</select></div>' +
      '<div><label>入職日</label><input type="date" name="hireDate" value="' + esc(s.hireDate) + '"></div>' +
      '<div><label>資格</label><input type="text" name="qualification" value="' + esc(s.qualification) + '"></div>' +
      '<div><label>退職日</label><input type="date" name="retireDate" value="' + esc(s.retireDate) + '"></div></div>' +
      '<p class="muted small">退職した職員は削除せず、退職日を入力してください。受講記録は残ります。</p>' +
      '<div class="actions"><button type="submit">保存する</button><button type="button" class="danger" id="del">削除</button></div></form>';
  });

  // ---------- 運営指導対応 ----------
  function complianceChecks() {
    var past = function (key) { var y = calYear(key); return today() > y + '-' + key + '-31'; };
    var fyOver = today() > fyEnd();
    var out = [];
    LEGAL_GROUPS.forEach(function (g) {
      var done = g.months.filter(function (k) { return sessionView(k).status === '実施済'; });
      out.push({
        name: g.name + ' 研修（年1回以上）', ok: done.length > 0,
        detail: done.length ? done.map(function (k) { return monthOf(k) + '（' + wa(sessionView(k).date) + '）'; }).join('、') : '未実施（計画：' + g.months.map(monthOf).join('・') + '）',
        due: g.months.every(past) || fyOver
      });
      // 全職員の受講
      var staffNg = S.staff.filter(function (s) {
        var any = done.some(function (k) { return completion(s.id, k) !== '対象外'; });
        return any && !done.some(function (k) { var c = completion(s.id, k); return c === '参加' || c === '回覧済'; });
      });
      if (done.length) out.push({ name: g.name + ' 全職員の受講', ok: !staffNg.length, detail: staffNg.length ? '未完了：' + staffNg.map(function (s) { return s.name; }).join('、') : '対象職員全員が受講または資料回覧・テスト提出済み', due: true });
    });
    var c1 = committeeRecordsFor('虐待防止検討委員会'), c2 = committeeRecordsFor('感染対策委員会');
    out.push({ name: '虐待防止検討委員会（定期的に開催）', ok: c1.length > 0, detail: c1.length ? c1.map(function (r) { return wa(r.date); }).join('、') : '今年度の議事録なし（計画：5月・12月）', due: past('05') });
    out.push({ name: '感染対策委員会（おおむね6月に1回以上）', ok: c2.length >= 2 || (c2.length >= 1 && !past('12')), detail: c2.length ? c2.length + '回：' + c2.map(function (r) { return wa(r.date); }).join('、') : '今年度の議事録なし（計画：6月・12月）', due: past('06') });
    var dI = committeeRecordsFor('感染症まん延防止訓練'), dN = committeeRecordsFor('BCP訓練（自然災害）'), dC = committeeRecordsFor('BCP訓練（感染症）');
    out.push({ name: '感染症まん延防止訓練（年1回以上）', ok: dI.length > 0, detail: dI.length ? dI.map(function (r) { return wa(r.date); }).join('、') : '記録なし（計画：11月）', due: past('11') });
    out.push({ name: 'BCP訓練 自然災害（年1回以上）', ok: dN.length > 0, detail: dN.length ? dN.map(function (r) { return wa(r.date); }).join('、') : '記録なし（計画：7月）', due: past('07') });
    out.push({ name: 'BCP訓練 感染症（年1回以上）', ok: dC.length > 0, detail: dC.length ? dC.map(function (r) { return wa(r.date); }).join('、') : '記録なし（計画：11月）', due: past('11') });
    var hires = S.staff.filter(function (s) { return inFY(s.hireDate); });
    var nhNg = hires.filter(function (s) { var nh = S.newHire[s.id]; return !(nh && nh.items && nh.items[1] && nh.items[1].date); });
    out.push({ name: '新規採用時の虐待防止研修', ok: !nhNg.length, detail: hires.length ? (nhNg.length ? '未記録：' + nhNg.map(function (s) { return s.name; }).join('、') : '今年度採用' + hires.length + '名すべて実施済み') : '今年度の新規採用者なし', due: true });
    // 記録の不備
    var gaps = [];
    MONTHS.forEach(function (m) {
      var ss = sessionView(m.key);
      if (ss.status !== '実施済') {
        if (past(m.key) && ss.status === '予定') gaps.push(m.month + '：予定のまま（実施済・延期の更新が必要）');
        if ((ss.status === '延期' || ss.status === '中止') && !ss.note) gaps.push(m.month + '：' + ss.status + 'の理由を備考に記入');
        return;
      }
      var miss = [];
      if (!ss.start || !ss.end) miss.push('時間');
      if (!ss.instructorName) miss.push('講師名');
      if (!ss.summary) miss.push('要旨');
      if (!ss.managerCheckDate) miss.push('管理者確認');
      if (miss.length) gaps.push(m.month + '：' + miss.join('・') + 'が未記入');
    });
    out.push({ name: '研修記録の記入漏れ', ok: !gaps.length, detail: gaps.length ? gaps.join(' ／ ') : '記入漏れなし', due: gaps.length > 0 });
    return out;
  }

  route(/^\/inspection$/, function () {
    var checks = complianceChecks();
    later(function () {
      document.getElementById('csv1').onclick = exportResultsCsv;
      document.getElementById('csv2').onclick = exportMatrixCsv;
    });
    return '<h1>運営指導対応</h1>' +
      '<div class="notice">運営指導（実地指導）では、研修計画・研修の実施記録・参加者の記録・欠席者への対応・委員会・訓練の記録などが確認されます。下の帳票を印刷（またはPDF保存）して、紙の署名欄に署名を集めて保管してください。</div>' +
      '<h2>法定研修・委員会・訓練の実施状況（' + reiwa(S.settings.startYear) + '）</h2>' +
      '<div class="table-wrap"><table><tr><th>項目</th><th class="c">判定</th><th>内容</th></tr>' + checks.map(function (c) {
        var b = c.ok ? '<span class="badge ok">OK</span>' : c.due ? '<span class="badge warn">要対応</span>' : '<span class="badge gray">予定</span>';
        return '<tr><td>' + esc(c.name) + '</td><td class="c">' + b + '</td><td class="small">' + esc(c.detail) + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p class="muted small">判定は研修計画（年間研修計画シート）と運営基準の頻度をもとにした目安です。指定権者（都道府県・市町村）の指導内容も確認してください。</p>' +
      '<h2>帳票の印刷・PDF保存</h2><div class="grid">' +
      printLink('#/print/plan', '年間研修計画・実施状況', '月別の研修計画と実施日・参加人数・状況、委員会・訓練計画') +
      printLink('#/print/records', '様式1・2　研修実施記録＋参加者名簿（全月）', '実施済の研修をまとめて印刷。署名欄つき') +
      printLink('#/print/matrix', '職員別 受講状況一覧', '職員×12か月の受講・回覧・点数の一覧') +
      printLink('#/print/meetings', '様式3・4　委員会議事録・訓練記録（全件）', '今年度の議事録・訓練記録') +
      printLink('#/print/newhires', '様式5　新規採用時研修記録（全員）', '今年度に入職した職員の記録') +
      printLink('#/print/tests', '確認テスト 問題用紙（12か月分）', '紙で実施する場合・欠席者への配布用') +
      printLink('#/print/answers', '確認テスト 解答・解説', '管理者・講師用') +
      printLink('#/print/log', '更新履歴', 'いつ・何を記録したかの履歴') +
      '</div>' +
      '<h2>データ出力（Excel で開けるCSV）</h2><div class="actions"><button id="csv1" class="sub">確認テスト受験記録CSV</button><button id="csv2" class="sub">職員別 受講状況CSV</button></div>' +
      '<h2>運営指導の前に確認すること</h2><div class="card"><ul>' +
      '<li>年間研修計画があり、計画どおりに実施したか（ずれた場合は理由を備考に記録）</li>' +
      '<li>法定研修（虐待防止・感染症・BCP）を年1回以上、虐待防止は新規採用時にも実施したか</li>' +
      '<li>研修記録に、実施日時・講師・内容・参加者が残っているか（参加者名簿の署名）</li>' +
      '<li>欠席者が資料を読み、確認テストを提出した記録があるか</li>' +
      '<li>虐待防止検討委員会・感染対策委員会の議事録と、職員への周知の記録があるか</li>' +
      '<li>BCP（自然災害・感染症）の訓練、感染症まん延防止訓練の記録があるか</li>' +
      '<li>虐待防止のための指針・感染症の指針・BCPが整備され、見直しをしているか（書類は別途保管）</li>' +
      '<li>記録は実際に行った内容をそのまま書いているか（後から作成した場合は記録作成日を記入）</li>' +
      '</ul></div>';
  });
  function printLink(href, title, desc) { return '<a class="card month-card" href="' + href + '"><b>' + esc(title) + '</b><div class="muted small">' + esc(desc) + '</div></a>'; }

  function exportResultsCsv() {
    var rows = [['受験日時', '月', '研修テーマ', '氏名', '種類', '点数', '要フォロー', '問1', '問2', '問3', '問4', '問5', '問6', '問7', '問8', '問9', '問10']];
    S.results.slice().sort(function (a, b) { return a.takenAt < b.takenAt ? -1 : 1; }).forEach(function (r) {
      var m = BY_KEY[r.month];
      rows.push([r.takenAt.replace('T', ' '), m.month, m.theme, staffName(r.staffId), r.kind, r.score, r.score < S.settings.passMark ? '要' : ''].concat(r.answers));
    });
    download('確認テスト受験記録_' + today() + '.csv', csv(rows), 'text/csv');
  }
  function exportMatrixCsv() {
    var head = ['氏名', '職種', '雇用形態', '入職日', '退職日'];
    MONTHS.forEach(function (m) { head.push(m.month + ' 受講', m.month + ' 点数'); });
    var rows = [head];
    S.staff.forEach(function (s) {
      var r = [s.name, s.job, s.employment, s.hireDate, s.retireDate];
      MONTHS.forEach(function (m) { var sc = scoreOf(s.id, m.key); r.push(completion(s.id, m.key), sc ? sc.score : ''); });
      rows.push(r);
    });
    download('職員別受講状況_' + today() + '.csv', csv(rows), 'text/csv');
  }

  // ---------- 印刷用帳票 ----------
  function paperShell(title, inner) {
    later(function () { var b = document.getElementById('doprint'); if (b) b.onclick = function () { window.print(); }; });
    return '<div class="actions"><button class="sub" onclick="history.back()">← 戻る</button><button id="doprint">印刷・PDF保存</button></div>' +
      '<p class="muted small no-print">印刷画面で「送信先：PDFに保存」を選ぶとPDFにできます。' + esc(title) + '</p>' + inner;
  }
  function officeLine() { return '<p>事業所名：' + esc(S.settings.office) + '</p>'; }
  function trow(label, val, pre) { return '<tr><th>' + esc(label) + '</th><td' + (pre ? ' class="pre"' : '') + '>' + val + '</td></tr>'; }
  function box(list, cur) { return list.map(function (v) { return ((cur || []).indexOf(v) >= 0 ? '☑' : '□') + ' ' + esc(v); }).join('　'); }

  function paperRecord(key) {
    var m = BY_KEY[key], ss = sessionView(key), st = sessionStats(key);
    var mins = minutesBetween(ss.start, ss.end);
    var cat = m.legal ? '法定研修（虐待防止・感染症・BCP）' : '事業所研修';
    var list = targets(key);
    var present = list.filter(function (s) { return attendance(s.id, key) === '参加'; });
    var absent = S.staff.filter(function (s) { return attendance(s.id, key) === '欠席'; });
    var f1 = '<div class="paper"><h1>様式1　研修実施記録</h1>' + officeLine() + '<table>' +
      trow('研修名', esc(monthOf(key) + '　' + m.theme)) +
      trow('区分', box(['法定研修（虐待防止・感染症・BCP）', '事業所研修', '新規採用時研修'], [cat])) +
      trow('実施日時', esc(wa(ss.date)) + '　' + esc(ss.start) + ' 〜 ' + esc(ss.end) + (mins ? '（' + mins + '分間）' : '')) +
      trow('実施場所・方法', box(PLACES, ss.place)) +
      trow('講師', '氏名：' + esc(ss.instructorName) + '　職名：' + esc(ss.instructorTitle)) +
      trow('参加者数', present.length + '名（様式2 参加者名簿のとおり）／対象者 ' + st.target + '名') +
      trow('使用資料', box(['研修資料', '確認テスト'], ss.materials).replace('研修資料', '研修資料（' + monthOf(key) + '）') + (ss.materialsOther ? '　その他：' + esc(ss.materialsOther) : '')) +
      trow('研修内容の要旨', esc(ss.summary), true) +
      trow('質疑・意見交換の内容', esc(ss.qa), true) +
      trow('理解度確認の結果', '確認テスト平均 ' + (st.avg === '' ? '　' : st.avg) + '点／満点 10点、要フォロー者 ' + st.follow.length + '名') +
      trow('欠席者への対応', box(['資料回覧＋確認テスト', '伝達研修'], ss.absentMethod) + (ss.absentOther ? '　' + esc(ss.absentOther) : '')) +
      trow('今後の課題・次回への反映', esc(ss.issues), true) +
      trow('備考（計画との差異など）', esc(ss.note), true) +
      trow('記録作成日・記録者', esc(wa(ss.recordDate)) + '　記録者：' + esc(ss.recorder)) +
      trow('管理者確認', '確認日：' + esc(wa(ss.managerCheckDate)) + '　署名：' + esc(ss.managerName) + '<span style="display:inline-block;width:8em"></span>') +
      '</table></div>';
    var n = Math.max(present.length, 10);
    var prow = '';
    for (var i = 0; i < n; i++) {
      var s = present[i], sc = s && scoreOf(s.id, key);
      prow += '<tr class="sign"><td class="c">' + (i + 1) + '</td><td>' + (s ? esc(s.name) : '') + '</td><td>' + (s ? esc(s.job + '・' + s.employment) : '') + '</td><td></td><td class="c">' + (sc ? sc.score + '点' : '') + '</td></tr>';
    }
    var arow = '';
    for (var j = 0; j < Math.max(absent.length, 5); j++) {
      var a = absent[j], ab = a ? (ss.absentees[a.id] || {}) : {}, asc = a && scoreOf(a.id, key);
      var sub = ab.submittedDate || (asc && asc.at ? asc.at.slice(0, 10) : '');
      arow += '<tr class="sign"><td class="c">' + (j + 1) + '</td><td>' + (a ? esc(a.name) : '') + '</td><td>' + esc(wa(ab.receivedDate)) + '</td><td>' + esc(wa(sub)) + '</td><td class="c">' + (asc ? asc.score + '点' : '') + '</td><td></td><td>' + esc(wa(ab.checked)) + '</td></tr>';
    }
    var f2 = '<div class="paper"><h1>様式2　参加者名簿・欠席者回覧確認表</h1><table>' +
      trow('研修名', esc(monthOf(key) + '　' + m.theme)) + trow('実施日', esc(wa(ss.date))) + '</table>' +
      '<h3>参加者名簿（当日参加者は本人署名）</h3><table class="list"><tr><th class="c">No.</th><th>氏名</th><th>職種・雇用形態</th><th style="width:28%">署名</th><th class="c">確認テスト点数</th></tr>' + prow + '</table>' +
      '<h3>欠席者 資料回覧確認表（資料を読み、確認テストを提出した日に署名）</h3><table class="list"><tr><th class="c">No.</th><th>氏名</th><th>資料受領日</th><th>確認テスト提出日</th><th class="c">点数</th><th style="width:16%">本人署名</th><th>管理者確認</th></tr>' + arow + '</table>' +
      '<p class="small">確認テストの点数・提出日は研修アプリの受験記録（受験日時つき）によります。</p></div>';
    return f1 + f2;
  }
  route(/^\/print\/record\/(\d\d)$/, function (key) { return paperShell('様式1・2', paperRecord(key)); });
  route(/^\/print\/records$/, function () {
    var keys = MONTHS.filter(function (m) { return sessionView(m.key).status === '実施済'; }).map(function (m) { return m.key; });
    return paperShell('様式1・2（実施済の全研修）', keys.length ? keys.map(paperRecord).join('') : '<p>実施済の研修がありません。</p>');
  });

  route(/^\/print\/plan$/, function () {
    var done = MONTHS.filter(function (m) { return sessionView(m.key).status === '実施済'; });
    var legalDone = done.filter(function (m) { return m.legal; });
    return paperShell('年間研修計画', '<div class="paper"><h1>' + reiwa(S.settings.startYear) + '　年間研修計画・実施状況（訪問介護）</h1>' + officeLine() +
      '<p class="small">★は法定研修（運営基準で年1回以上の実施が義務）</p>' +
      '<table class="list"><tr><th>月</th><th>研修テーマ</th><th>区分</th><th>主な内容</th><th>講師</th><th>実施日</th><th class="c">参加人数</th><th>状況</th><th>備考</th></tr>' +
      MONTHS.map(function (m) {
        var ss = sessionView(m.key), st = sessionStats(m.key);
        return '<tr><td>' + esc(m.month) + '</td><td>' + (m.legal ? '★' : '') + esc(m.theme) + '</td><td>' + esc(m.category) + '</td><td class="small">' + esc(m.content) + '</td><td>' + esc(ss.instructorName || m.instructor) + '</td><td>' + esc(wa(ss.date)) + '</td><td class="c">' + (ss.status === '実施済' ? st.present + '名' : '') + '</td><td>' + esc(ss.status) + '</td><td class="small">' + esc(ss.note) + '</td></tr>';
      }).join('') + '</table>' +
      '<p>実施済の研修数：' + done.length + '　実施済の法定研修数（★）：' + legalDone.length + '　未実施の研修数：' + (12 - done.length) + '　実施率：' + Math.round(done.length / 12 * 100) + '%</p>' +
      '<h3>委員会・訓練の年間計画</h3><table class="list"><tr><th>項目</th><th>頻度の基準</th><th>実施予定月</th><th>担当</th><th>実施日</th><th>記録</th></tr>' +
      D.committees.map(function (c) {
        var recs = committeeRecordsFor(c.item);
        return '<tr><td>' + esc(c.item) + '</td><td>' + esc(c.freq) + '</td><td>' + esc(c.months) + '</td><td>' + esc(c.owner) + '</td><td>' + (recs ? recs.map(function (r) { return esc(wa(r.date)); }).join('<br>') : '') + '</td><td>' + esc(c.record) + '</td></tr>';
      }).join('') + '</table></div>');
  });

  route(/^\/print\/matrix$/, function () {
    var mark = function (s, k) {
      var c = completion(s.id, k), sc = scoreOf(s.id, k);
      var t = { '参加': '○', '回覧済': '回', '回覧中': '回(未提出)', '未': '未', '対象外': '—', '': '' }[c];
      return t + (sc && c !== '対象外' ? '<br>' + sc.score + '点' : '');
    };
    return paperShell('職員別受講状況', '<div class="paper"><h1>' + reiwa(S.settings.startYear) + '　職員別 研修受講状況</h1>' + officeLine() +
      '<p class="small">○：研修に参加　回：欠席し資料回覧・確認テスト提出済み　未：未受講　—：対象外（入職前・退職後）　空欄：研修未実施</p>' +
      '<div class="table-wrap"><table class="list"><tr><th>氏名</th>' + MONTHS.map(function (m) { return '<th class="c">' + (m.legal ? '★' : '') + esc(m.month) + '</th>'; }).join('') + '</tr>' +
      S.staff.map(function (s) {
        return '<tr><td>' + esc(s.name) + (s.retireDate ? '<br><span class="small">（' + esc(wa(s.retireDate)) + '退職）</span>' : '') + '</td>' + MONTHS.map(function (m) { return '<td class="c small">' + mark(s, m.key) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div></div>');
  });

  route(/^\/print\/person\/(\w+)$/, function (id) {
    var s = staffById(id);
    if (!s) return '<p>職員が見つかりません。</p>';
    var rs = S.results.filter(function (r) { return r.staffId === id; }).sort(function (a, b) { return a.takenAt < b.takenAt ? -1 : 1; });
    return paperShell('個人別受講履歴', '<div class="paper"><h1>研修受講履歴　' + esc(s.name) + '</h1>' + officeLine() +
      '<p>職種：' + esc(s.job) + '・' + esc(s.employment) + '　入職日：' + esc(wa(s.hireDate)) + '　資格：' + esc(s.qualification) + '</p>' +
      '<table class="list"><tr><th>月</th><th>研修テーマ</th><th>実施日</th><th>受講</th><th class="c">確認テスト</th></tr>' + MONTHS.map(function (m) {
        var sc = scoreOf(id, m.key);
        return '<tr><td>' + esc(m.month) + '</td><td>' + (m.legal ? '★' : '') + esc(m.theme) + '</td><td>' + esc(wa(sessionView(m.key).date)) + '</td><td>' + esc(completion(id, m.key)) + '</td><td class="c">' + (sc ? sc.score + '点' : '') + '</td></tr>';
      }).join('') + '</table>' +
      '<h3>確認テスト受験記録</h3><table class="list"><tr><th>受験日時</th><th>研修</th><th>種類</th><th class="c">点数</th></tr>' +
      (rs.length ? rs.map(function (r) { return '<tr><td>' + esc(waDateTime(r.takenAt)) + '</td><td>' + esc(monthOf(r.month) + ' ' + BY_KEY[r.month].theme) + '</td><td>' + esc(r.kind) + '</td><td class="c">' + r.score + '点</td></tr>'; }).join('') : '<tr><td colspan="4">記録なし</td></tr>') + '</table></div>');
  });

  function paperCommittee(c) {
    return '<div class="paper"><h1>様式3　委員会議事録</h1>' + officeLine() + '<table>' +
      trow('委員会名', box(COMMITTEE_TYPES, [c.type])) +
      trow('開催日時', esc(wa(c.date)) + '　' + esc(c.start || '') + ' 〜 ' + esc(c.end || '')) +
      trow('開催方法', box(['対面', 'オンライン'], [c.method])) +
      trow('出席者（氏名・役割）', '委員長：' + esc(c.chair || '') + '　担当者：' + esc(c.officer || '') + '　その他：' + esc(c.others || '')) +
      trow('前回からの報告事項', esc(c.report || ''), true) + trow('議題1', esc(c.agenda1 || ''), true) + trow('議題2', esc(c.agenda2 || ''), true) +
      trow('検討結果・決定事項', esc(c.decision || ''), true) +
      trow('指針・マニュアルの見直し', box(['変更なし', '変更あり'], [c.guidelineChange]) + (c.guidelineDetail ? '（内容：' + esc(c.guidelineDetail) + '）' : '')) +
      trow('職員への周知方法・周知日', box(['会議で説明', '回覧', '掲示'], c.noticeMethod) + '　周知日：' + esc(wa(c.noticeDate))) +
      trow('次回開催予定', esc(c.next || '')) +
      trow('記録者・管理者確認', '記録者：' + esc(c.recorder || '') + '　管理者署名：' + esc(c.managerName || '')) + '</table></div>';
  }
  function paperDrill(c) {
    return '<div class="paper"><h1>様式4　訓練実施記録（BCP・感染症）</h1>' + officeLine() + '<table>' +
      trow('訓練の種類', box(DRILL_TYPES, c.types)) +
      trow('実施日時', esc(wa(c.date)) + '　' + esc(c.start || '') + ' 〜 ' + esc(c.end || '')) +
      trow('実施方法', box(['机上訓練（シミュレーション）', '実地訓練', '組み合わせ'], [c.method])) +
      trow('参加者', esc(c.participants || '') + '名（様式2のとおり）') +
      trow('想定した状況', esc(c.scenario || ''), true) + trow('訓練の流れ', esc(c.flow || ''), true) +
      trow('確認できたこと', esc(c.confirmed || ''), true) + trow('課題・うまくいかなかったこと', esc(c.problems || ''), true) +
      trow('BCP・マニュアルへの反映', box(['反映不要', '反映あり'], [c.reflect]) + (c.reflectDetail ? '（' + esc(c.reflectDetail) + '）' : '')) +
      trow('記録者・管理者確認', '記録者：' + esc(c.recorder || '') + '　管理者署名：' + esc(c.managerName || '')) + '</table></div>';
  }
  route(/^\/print\/committee\/(\w+)$/, function (id) { var c = S.committees.filter(function (x) { return x.id === id; })[0]; return c ? paperShell('様式3', paperCommittee(c)) : '<p>記録が見つかりません。</p>'; });
  route(/^\/print\/drill\/(\w+)$/, function (id) { var c = S.drills.filter(function (x) { return x.id === id; })[0]; return c ? paperShell('様式4', paperDrill(c)) : '<p>記録が見つかりません。</p>'; });
  route(/^\/print\/meetings$/, function () {
    var byDate = function (a, b) { return a.date < b.date ? -1 : 1; };
    var c = S.committees.filter(function (x) { return inFY(x.date); }).sort(byDate).map(paperCommittee).join('');
    var d = S.drills.filter(function (x) { return inFY(x.date); }).sort(byDate).map(paperDrill).join('');
    return paperShell('様式3・4', (c + d) || '<p>今年度の記録がありません。</p>');
  });

  function paperNewHire(s) {
    var nh = S.newHire[s.id] || { items: [] };
    return '<div class="paper"><h1>様式5　新規採用時研修記録</h1>' + officeLine() + '<table>' +
      trow('氏名', esc(s.name)) + trow('入職日', esc(wa(s.hireDate))) + trow('資格', esc(s.qualification)) + '</table><br>' +
      '<table class="list"><tr><th class="c">No.</th><th>研修内容</th><th>実施日</th><th>講師</th><th style="width:18%">本人署名</th></tr>' +
      NEWHIRE_ITEMS.map(function (t, i) {
        var it = (nh.items || [])[i] || {};
        return '<tr class="sign"><td class="c">' + (i + 1) + '</td><td>' + esc(t) + (i >= 6 ? '（利用者名：' + esc(it.client || '') + '）' : '') + '</td><td>' + esc(wa(it.date)) + '</td><td>' + esc(it.instructor || '') + '</td><td></td></tr>';
      }).join('') + '</table><br><table>' +
      trow('単独訪問の開始日', esc(wa(nh.soloStart))) + trow('サービス提供責任者確認', esc(nh.sekiCheck || '')) + trow('管理者確認', esc(nh.managerCheck || '')) + '</table></div>';
  }
  route(/^\/print\/newhire\/(\w+)$/, function (id) { var s = staffById(id); return s ? paperShell('様式5', paperNewHire(s)) : '<p>職員が見つかりません。</p>'; });
  route(/^\/print\/newhires$/, function () {
    var list = S.staff.filter(function (s) { return inFY(s.hireDate); });
    return paperShell('様式5（今年度採用者）', list.length ? list.map(paperNewHire).join('') : '<p>今年度に入職した職員がいません（入職日を登録してください）。</p>');
  });

  function paperTest(key) {
    var m = BY_KEY[key];
    var row = function (q) {
      var t = esc(q.q) + (q.choices.length ? '<br>' + q.choices.map(function (c) { return '　' + c.k + '　' + esc(c.t); }).join('<br>') : '');
      return '<tr><td class="c">' + q.no + '</td><td>' + t + '</td><td style="width:14%"></td></tr>';
    };
    return '<div class="paper"><h1>確認テスト　' + esc(m.month) + '　' + esc(m.theme) + '</h1>' +
      '<table><tr><th>実施日</th><td>令和　　年　　月　　日</td></tr><tr><th>氏名</th><td></td></tr><tr><th>点数</th><td>　　　点 ／ 10点</td></tr></table>' +
      '<p>問1〜問5　正しいものに○、誤っているものに×を解答欄に書いてください。</p><table class="list"><tr><th class="c">問</th><th>問題</th><th>解答欄</th></tr>' + m.test.slice(0, 5).map(row).join('') + '</table>' +
      '<p>問6〜問10　正しいもの（または問われているもの）を、ア・イ・ウから1つ選んで解答欄に書いてください。</p><table class="list"><tr><th class="c">問</th><th>問題</th><th>解答欄</th></tr>' + m.test.slice(5).map(row).join('') + '</table></div>';
  }
  route(/^\/print\/test\/(\d\d)$/, function (key) { return paperShell('問題用紙', paperTest(key)); });
  route(/^\/print\/tests$/, function () { return paperShell('問題用紙（12か月分）', MONTHS.map(function (m) { return paperTest(m.key); }).join('')); });
  route(/^\/print\/answers$/, function () {
    return paperShell('解答・解説', '<div class="paper"><h1>確認テスト　解答・解説（管理者・講師用）</h1>' + MONTHS.map(function (m) {
      return '<h3>' + esc(m.month) + '　' + esc(m.theme) + '</h3><table class="list"><tr><th class="c">問</th><th class="c">正解</th><th>解説</th></tr>' +
        m.test.map(function (q) { return '<tr><td class="c">' + q.no + '</td><td class="c">' + esc(q.answer) + '</td><td>' + esc(q.explain) + '</td></tr>'; }).join('') + '</table>';
    }).join('') + '</div>');
  });
  route(/^\/print\/log$/, function () {
    return paperShell('更新履歴', '<div class="paper"><h1>更新履歴</h1>' + officeLine() + '<table class="list"><tr><th>日時</th><th>内容</th></tr>' +
      (S.log.length ? S.log.map(function (l) { return '<tr><td style="white-space:nowrap">' + esc(waDateTime(l.at)) + '</td><td>' + esc(l.msg) + '</td></tr>'; }).join('') : '<tr><td colspan="2">履歴なし</td></tr>') + '</table></div>');
  });

  // ---------- 設定・バックアップ ----------
  route(/^\/settings$/, function () {
    var st = S.settings;
    later(function () {
      var f = document.getElementById('set');
      f.onsubmit = function (e) {
        e.preventDefault();
        var d = formData(f);
        st.office = d.office; st.manager = d.manager; st.abuseOfficer = d.abuseOfficer; st.infectionOfficer = d.infectionOfficer;
        st.startYear = +d.startYear || st.startYear; st.passMark = Math.max(1, Math.min(10, +d.passMark || 7));
        save('設定を更新'); toast('保存しました'); render();
      };
      document.getElementById('backup').onclick = function () {
        download('研修アプリ_バックアップ_' + today() + '.json', JSON.stringify(S, null, 1), 'application/json');
        S.lastBackupAt = nowISO(); save();
      };
      document.getElementById('restore').onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var mode = document.querySelector('input[name=imode]:checked').value;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var x = JSON.parse(rd.result);
            if (!x || !x.settings || !Array.isArray(x.staff)) throw new Error('研修アプリのバックアップファイルではありません');
            if (mode === 'replace') {
              if (!confirm('今のデータをすべて置き換えます。よろしいですか？')) return;
              localStorage.setItem(STORE_KEY, JSON.stringify(x));
              S = load(); save('バックアップから復元（置き換え）');
            } else {
              var n = mergeIn(x);
              save('別端末のデータを取り込み：職員' + n.staff + '名、テスト' + n.results + '件');
              alert('取り込みました。職員 ' + n.staff + '名、確認テスト ' + n.results + '件、委員会・訓練 ' + n.meetings + '件を追加しました。');
            }
            render();
          } catch (err) { alert('読み込めませんでした：' + err.message); }
        };
        rd.readAsText(file);
      };
      document.getElementById('reset').onclick = function () {
        if (!confirm('すべてのデータを削除します。先にバックアップを保存してください。本当に削除しますか？')) return;
        if (prompt('確認のため「削除」と入力してください') !== '削除') return;
        localStorage.removeItem(STORE_KEY); S = defaultState(); render();
      };
    });
    return '<h1>設定・バックアップ</h1>' +
      '<form id="set" class="card"><h3>事業所の設定</h3><div class="row">' +
      '<div><label>事業所名</label><input type="text" name="office" value="' + esc(st.office) + '"></div>' +
      '<div><label>年度（開始年・西暦）</label><input type="number" name="startYear" value="' + esc(st.startYear) + '"><div class="muted small">' + reiwa(st.startYear) + '（' + wa(fyStart()) + '〜' + wa(fyEnd()) + '）</div></div>' +
      '<div><label>管理者</label><input type="text" name="manager" value="' + esc(st.manager) + '"></div>' +
      '<div><label>虐待防止担当者</label><input type="text" name="abuseOfficer" value="' + esc(st.abuseOfficer) + '"></div>' +
      '<div><label>感染対策担当者</label><input type="text" name="infectionOfficer" value="' + esc(st.infectionOfficer) + '"></div>' +
      '<div><label>確認テストの合格目安（点）</label><input type="number" min="1" max="10" name="passMark" value="' + esc(st.passMark) + '"></div></div>' +
      '<div class="actions"><button type="submit">保存する</button></div></form>' +
      '<div class="card"><h3>バックアップ</h3>' +
      '<div class="alert small">データはこの端末のブラウザの中に保存されています。ブラウザの履歴削除や端末の故障で消えるため、<b>月に1回以上バックアップファイルを保存</b>し、事業所のパソコンや共有フォルダに保管してください。' + (S.lastBackupAt ? '<br>前回のバックアップ：' + esc(waDateTime(S.lastBackupAt)) : '<br>まだバックアップしていません。') + '</div>' +
      '<div class="actions"><button id="backup">バックアップを保存</button></div>' +
      '<h3>バックアップの読み込み</h3><div class="checks"><label><input type="radio" name="imode" value="merge" checked>追加で取り込む（別の端末で受けたテスト結果などを合わせる）</label><label><input type="radio" name="imode" value="replace">置き換える（復元）</label></div>' +
      '<p><input type="file" id="restore" accept=".json,application/json"></p></div>' +
      '<div class="card"><h3>データの削除</h3><div class="actions"><button class="danger" id="reset">すべてのデータを削除</button></div></div>';
  });

  // 別端末のデータを取り込む（IDが同じものは上書きしない。職員は氏名でも照合）
  function mergeIn(x) {
    var n = { staff: 0, results: 0, meetings: 0 };
    var idMap = {};
    (x.staff || []).forEach(function (s) {
      var same = staffById(s.id) || S.staff.filter(function (t) { return t.name === s.name; })[0];
      if (same) { idMap[s.id] = same.id; return; }
      S.staff.push(s); idMap[s.id] = s.id; n.staff++;
    });
    var have = {};
    S.results.forEach(function (r) { have[r.id] = 1; });
    (x.results || []).forEach(function (r) {
      if (have[r.id]) return;
      r.staffId = idMap[r.staffId] || r.staffId;
      S.results.push(r); n.results++;
    });
    [['committees', S.committees], ['drills', S.drills]].forEach(function (p) {
      var ids = {};
      p[1].forEach(function (r) { ids[r.id] = 1; });
      (x[p[0]] || []).forEach(function (r) { if (!ids[r.id]) { p[1].push(r); n.meetings++; } });
    });
    Object.keys(x.sessions || {}).forEach(function (k) {
      var src = x.sessions[k];
      if (!S.sessions[k] || (S.sessions[k].status === '予定' && src.status !== '予定')) { S.sessions[k] = src; return; }
      var dst = S.sessions[k];
      ['attendees', 'absentees', 'paperScores'].forEach(function (f) {
        Object.keys(src[f] || {}).forEach(function (sid) {
          var id = idMap[sid] || sid;
          if (dst[f][id] === undefined) dst[f][id] = src[f][sid];
        });
      });
    });
    Object.keys(x.newHire || {}).forEach(function (sid) {
      var id = idMap[sid] || sid;
      if (!S.newHire[id]) S.newHire[id] = x.newHire[sid];
    });
    return n;
  }

  render();
})();
