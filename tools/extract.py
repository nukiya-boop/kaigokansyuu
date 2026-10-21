import sys, re, json, openpyxl
test_path, mat_path, out = sys.argv[1:4]
tw = openpyxl.load_workbook(test_path, data_only=True)
mw = openpyxl.load_workbook(mat_path, data_only=True)

months = ['04','05','06','07','08','09','10','11','12','01','02','03']
def s(v): return '' if v is None else str(v).strip()

# plan
plan = {}
ws = mw['年間研修計画']
for r in ws.iter_rows(min_row=1, max_row=40, values_only=True):
    if not re.fullmatch(r'\d+月', s(r[0])): continue
    m = s(r[0]).replace('月','')
    plan[m.zfill(2)] = dict(theme=s(r[1]).lstrip('★'), legal=s(r[1]).startswith('★'), category=s(r[2]), content=s(r[3]), instructor=s(r[4]))
committees = []
started=False
for r in ws.iter_rows(min_row=1, values_only=True):
    if s(r[0]).startswith('委員会・訓練'): started=True; continue
    if started and s(r[1]) and s(r[1])!='項目': committees.append(dict(item=s(r[1]), freq=s(r[2]), months=s(r[3]), owner=s(r[4]), record=s(r[8])))

# refs
refs = {}
ws = mw['参考資料']; cur = None
for row in ws.iter_rows(min_row=4):
    if s(row[0].value): cur = s(row[0].value).replace('月','').zfill(2)
    if not s(row[2].value): continue
    link = row[5].hyperlink.target if row[5].hyperlink else ''
    refs.setdefault(cur, []).append(dict(name=s(row[2].value), org=s(row[3].value), use=s(row[4].value), url=link))

# materials
mats = {}
for name in mw.sheetnames:
    m = re.match(r'(\d\d)月_', name)
    if not m: continue
    key = m.group(1); ws = mw[name]
    title = s(ws['A1'].value); aim = ''
    blocks = []; review = []; mode = 'body'; table = None
    for row in ws.iter_rows(min_row=2):
        vals = [s(c.value) for c in row]
        ne = [v for v in vals if v]
        if not ne: table = None; continue
        first = row[0]; text = vals[0]
        if text.startswith('ねらい：'): aim = text[4:]; continue
        if text.startswith('確認テスト'): mode = 'review'; table=None; continue
        if text == '解答': mode = 'answer'; continue
        if text.startswith('参考資料'): mode = 'refs'; continue
        if mode == 'review':
            mm = re.match(r'(\d+)\.\s*(.*)', text); review.append(dict(q=mm.group(2))); continue
        if mode == 'answer':
            for mm in re.finditer(r'（(\d+)）\s*([○×])(?:（([^）]*)）)?', text):
                i = int(mm.group(1))-1
                review[i]['a'] = mm.group(2); review[i]['note'] = mm.group(3) or ''
            continue
        if mode == 'refs': continue
        if len(ne) > 1:
            cells = [v for v in vals]
            while cells and not cells[-1]: cells.pop()
            cells = [c for c in cells if c] if True else cells
            if table is None:
                table = dict(type='table', head=cells if first.font.bold else None, rows=[])
                blocks.append(table)
                if first.font.bold: continue
            table['rows'].append(cells); continue
        table = None
        if first.font.bold: blocks.append(dict(type='h', text=text))
        else: blocks.append(dict(type='p', text=text))
    mats[key] = dict(title=title, aim=aim, blocks=blocks, review=review)

# tests
answers = {}
ws = tw['解答・解説']
for r in ws.iter_rows(min_row=1, values_only=True):
    mo = s(r[0]); 
    if re.fullmatch(r'\d+月', mo) and s(r[1]).isdigit():
        answers[(mo.replace('月','').zfill(2), int(r[1]))] = (s(r[2]), s(r[3]))
tests = {}
for name in tw.sheetnames:
    m = re.match(r'(\d\d)月_テスト', name)
    if not m: continue
    key = m.group(1); qs = []
    for r in tw[name].iter_rows(min_row=1, values_only=True):
        if isinstance(r[0], (int, float)) or s(r[0]).isdigit():
            no = int(r[0]); lines = s(r[1]).split('\n')
            q = lines[0].strip(); choices = []
            for l in lines[1:]:
                mm = re.match(r'\s*([アイウ])\s+(.*)', l.replace('　',' '))
                if mm: choices.append(dict(k=mm.group(1), t=mm.group(2).strip()))
            a, ex = answers[(key, no)]
            qs.append(dict(no=no, type='abc' if choices else 'ox', q=q, choices=choices, answer=a, explain=ex))
    tests[key] = qs

data = []
for k in months:
    p = plan[k]
    data.append(dict(key=k, month=str(int(k))+'月', **p, title=mats[k]['title'], aim=mats[k]['aim'],
        blocks=mats[k]['blocks'], review=mats[k]['review'], refs=refs.get(k, []), test=tests[k]))
for d in data:
    assert len(d['test'])==10 and all(q['answer'] for q in d['test']), d['key']
    assert all('a' in r for r in d['review']), d['key']
with open(out,'w',encoding='utf-8') as f:
    f.write('// Excel「研修計画・研修資料・記録様式」「研修確認テスト集」から自動生成（tools/extract.py）\n')
    f.write('window.TRAINING_DATA = ' + json.dumps(dict(fiscalYear='令和8年度', months=data, committees=committees), ensure_ascii=False, indent=1) + ';\n')
print('ok', sum(len(d['blocks']) for d in data))
