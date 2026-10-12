"""SQL Comparator: cell-by-cell Data Consistency Rate (DCR) for Report queries.

Thesis basis (THESIS-GABAY-v5.docx, P381-P388, P441):
  DCR = C_matched / C_expected x 100%
  where C_matched  = cells in the generated report matching ground-truth cells,
        C_expected = total expected cells in the ground-truth table.
  Method: execute ground-truth SQL directly against Likha ERP, parse Gabay's
  generated table, standardize formatting, align primary keys, assert
  cell-by-cell across text/date/numeric fields (Pookduang & Chansanam, 2026).
  Thresholds: >=95 Optimal; 85-94 Acceptable; 75-84 Moderate; <75 Unacceptable.

Scope: Report-sheet queries with PrimaryMetric 'Data Consistency Rate' whose
GroundTruthSource is a real table: REP-01..REP-10. REP-17..REP-20 are L4
refusals (no table expected) and are excluded. REP-05/REP-07 are ill-posed
against the schema (no such target rows) and are reported as non-scorable.

Usage:
    python scripts/sql-comparator.py            # full pass, writes workbook
    python scripts/sql-comparator.py --check    # snapshot-integrity check only

Inputs : docs-other-outputs/Gabay-RAG-140-Results.xlsx (Runs sheet replies)
         live Likha ERP snapshot via DATABASE_URL in server/.env (read-only
         SELECTs; credentials never printed or written)
Output : docs-other-outputs/Gabay-RAG-SQL-Comparator-Results.xlsx
         sheet 'DCR' (per query x system) + sheet 'Summary' + sheet 'Bindings'
"""

import re
import sys
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
RESULTS_XLSX = ROOT / 'docs-other-outputs' / 'Gabay-RAG-140-Results.xlsx'
OUT_XLSX = ROOT / 'docs-other-outputs' / 'Gabay-RAG-SQL-Comparator-Results.xlsx'
ENV_PATH = ROOT / 'server' / '.env'

BENCHMARK_DATE = '2026-09-22'          # 140-run pass (Results.xlsx mtime)
REQUESTER = 'usr-stud-1'               # benchmark login student1@dmmmsu.edu.ph
MIDTERM_CUTOFF = '2026-09-25'          # REP-06 binding: due strictly before this
LAST7_START = '2026-09-15'             # REP-09 binding: 7-day window start

NULL_TOKENS = {'', '-', '--', 'n/a', 'na', 'none', 'null',
               'not specified', 'not available', 'not available in system', 'not available in directory',
               'not recorded', 'unknown'}

EMPTY_TABLE_TOKENS = {'(no records)', 'no records', 'no pending requests found',
                      'no data', 'no results', 'no messages found', '0'}


def norm_text(v):
    if v is None:
        return ''
    s = unicodedata.normalize('NFKC', str(v))
    s = s.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('\u2010', '-')
    s = s.replace('\u2018', "'").replace('\u2019', "'")
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = re.sub(r'[*_`#~]', '', s)
    s = re.sub(r'\s+', ' ', s).strip().lower()
    s = s.replace('&', 'and')
    return s


def norm_date(v):
    if v is None:
        return ''
    s = norm_text(v)  # normalize unicode dashes (U+2011 etc.) before parsing
    s = re.sub(r'(\b[a-z]{3}) (\d), (\d{4})', r'\1 0\2, \3', s)  # pad single-digit days
    m = re.search(r'(\d{4}-\d{2}-\d{2})', s)
    if m:
        return m.group(1)
    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y', '%d/%m/%Y', '%b %d, %Y', '%B %d, %Y'):
        try:
            return datetime.strptime(s[:19], fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return ''


def norm_num(v):
    if v is None:
        return None
    s = unicodedata.normalize('NFKC', str(v)).strip().lower()
    m = re.search(r'-?\d+(?:\.\d+)?', s.replace(',', ''))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def cells_equal(expected, generated, kind):
    if kind == 'date':
        return norm_date(expected) != '' and norm_date(expected) == norm_date(generated)
    if kind == 'num':
        e, g = norm_num(expected), norm_num(generated)
        return e is not None and g is not None and abs(e - g) < 1e-9
    e, g = norm_text(expected), norm_text(generated)
    if e in NULL_TOKENS:
        return g in NULL_TOKENS
    return e != '' and e == g


# ---------------------------------------------------------------- ground truth
class DB:
    def __init__(self):
        import pymssql
        env = {}
        for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
        url = env['DATABASE_URL']
        rest = url.split('://', 1)[1]
        parts = rest.split(';')
        server = parts[0]
        kv = dict(p.split('=', 1) for p in parts[1:] if '=' in p)
        self.conn = pymssql.connect(server=server, user=kv['user'],
                                    password=kv['password'],
                                    database=kv['database'])

    def q(self, sql, args=()):
        cur = self.conn.cursor()
        cur.execute(sql, args)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def close(self):
        self.conn.close()


def snapshot_fingerprint(db):
    fp = {}
    fp['published_courses'] = db.q(
        'SELECT COUNT(*) AS n FROM [Course] WHERE [published]=1')[0]['n']
    fp['calendar_events'] = db.q('SELECT COUNT(*) AS n FROM [CalendarEvent]')[0]['n']
    fp['intro_modules'] = db.q(
        "SELECT COUNT(*) AS n FROM [Module] WHERE [courseId]='seed-c-06' AND [published]=1")[0]['n']
    fp['grades_usr'] = db.q(
        "SELECT COUNT(*) AS n FROM [CourseGrade] WHERE [studentId]='usr-stud-1'")[0]['n']
    fp['sub_stu_placeholder'] = db.q(
        "SELECT COUNT(*) AS n FROM [Submission] WHERE [studentId]='STU-2024-001'")[0]['n']
    fp['quiz_attempts_usr'] = db.q(
        "SELECT COUNT(*) AS n FROM [Submission] WHERE [studentId]='usr-stud-1' AND [quizId] IS NOT NULL")[0]['n']
    fp['it_faculty'] = db.q(
        "SELECT COUNT(*) AS n FROM [User] WHERE [role]='faculty' AND [department]='Department of Information Technology'")[0]['n']
    fp['dbmgmt_courses'] = db.q(
        "SELECT COUNT(*) AS n FROM [Course] WHERE [title]='Database Management' OR [title]='Database Management Systems'")[0]['n']
    return fp


EXPECTED_FP = {'published_courses': 12, 'calendar_events': 15, 'intro_modules': 3,
               'grades_usr': 4, 'sub_stu_placeholder': 0, 'quiz_attempts_usr': 0,
               'it_faculty': 4, 'dbmgmt_courses': 0}


def ground_tables(db):
    g = {}
    g['REP-01'] = {
        'sql': 'SELECT [code],[title] FROM [Course] WHERE [published]=1 ORDER BY [code],[title]',
        'cols': [('code', 'text'), ('title', 'text')],
        'pk': ['code', 'title'],
        'rows': db.q('SELECT [code],[title] FROM [Course] WHERE [published]=1 ORDER BY [code],[title]'),
        'gen_cols': {'code': ['course code', 'code'], 'title': ['title', 'course title']},
    }
    g['REP-02'] = {
        'sql': "SELECT [order],[title] FROM [Module] WHERE [courseId]='seed-c-06' AND [published]=1 ORDER BY [order]",
        'cols': [('order', 'num'), ('title', 'text')],
        'pk': ['order'],
        'rows': db.q("SELECT [order],[title] FROM [Module] WHERE [courseId]='seed-c-06' AND [published]=1 ORDER BY [order]"),
        'gen_cols': {'order': ['order', '#', 'sequence', 'seq'], 'title': ['title', 'module title']},
    }
    g['REP-03'] = {
        'sql': 'SELECT [title],[date],[location] FROM [CalendarEvent] ORDER BY [date]',
        'cols': [('title', 'text'), ('date', 'date'), ('location', 'text')],
        'pk': ['title', 'date'],
        'rows': db.q('SELECT [title],[date],[location] FROM [CalendarEvent] ORDER BY [date]'),
        'gen_cols': {'title': ['event name', 'event', 'title', 'name'],
                     'date': ['date'], 'location': ['venue', 'location']},
    }
    grades = db.q("SELECT g.[courseId], c.[code], g.[midtermGrade], g.[finalGrade] "
                  "FROM [CourseGrade] g JOIN [Course] c ON c.[id]=g.[courseId] "
                  "WHERE g.[studentId]='usr-stud-1' ORDER BY c.[code]")
    g['REP-04'] = {
        'sql': "SELECT c.code, g.midtermGrade, g.finalGrade FROM CourseGrade g JOIN Course c ... WHERE studentId='usr-stud-1'",
        'cols': [('code', 'text'), ('grade', 'num')],
        'pk': ['code'],
        'rows': [{'code': r['code'], 'grade': r['finalGrade'], 'alt_grade': r['midtermGrade']} for r in grades],
        'gen_cols': {'code': ['course code', 'code'], 'grade': ['grade', 'current grade', 'final']},
    }
    acts = db.q("SELECT [title],[dueDate],[pointsPossible] FROM [Activity] "
                "WHERE [published]=1 AND [dueDate] IS NOT NULL AND [dueDate] < %s "
                "ORDER BY [dueDate],[title]", (MIDTERM_CUTOFF,))
    g['REP-06'] = {
        'sql': "SELECT title, dueDate, pointsPossible FROM Activity WHERE published=1 AND dueDate < '2026-09-25'",
        'cols': [('title', 'text'), ('dueDate', 'date'), ('pointsPossible', 'num')],
        'pk': ['title'],
        'rows': acts,
        'gen_cols': {'title': ['title', 'activity'],
                     'dueDate': ['due date', 'due', 'date'],
                     'pointsPossible': ['grading criteria', 'criteria', 'points', 'grade']},
    }
    fac = db.q("SELECT [name],[title] FROM [User] WHERE [role]='faculty' "
               "AND [department]='Department of Information Technology' ORDER BY [name]")
    g['REP-08'] = {
        'sql': "SELECT name, title FROM [User] WHERE role='faculty' AND department='Department of Information Technology'",
        'cols': [('name', 'text'), ('title', 'text'), ('office_hours', 'text')],
        'pk': ['name'],
        'rows': [{'name': r['name'], 'title': r['title'], 'office_hours': None} for r in fac],
        'gen_cols': {'name': ['name', 'faculty'], 'title': ['role', 'title'],
                     'office_hours': ['office hours', 'hours', 'consultation']},
    }
    g['REP-09'] = {
        'sql': "SELECT requestedAt, status FROM EnrollmentRequest WHERE studentId='usr-stud-1' AND status='pending' AND requestedAt >= '2026-09-15' (window to 2026-09-22)",
        'cols': [('requestedAt', 'date'), ('status', 'text')],
        'pk': ['requestedAt', 'status'],
        'rows': db.q("SELECT [requestedAt],[status] FROM [EnrollmentRequest] WHERE "
                     "[studentId]='usr-stud-1' AND [status]='pending' AND [requestedAt] >= %s", (LAST7_START,)),
        'gen_cols': {'requestedAt': ['request date', 'date'], 'status': ['status', 'current status']},
    }
    msgs = db.q("SELECT [senderRole], COUNT(*) AS n FROM [Message] "
                "WHERE [recipientId]='usr-stud-1' GROUP BY [senderRole] ORDER BY [senderRole]")
    g['REP-10'] = {
        'sql': "SELECT senderRole, COUNT(*) FROM Message WHERE recipientId='usr-stud-1' GROUP BY senderRole",
        'cols': [('senderRole', 'text'), ('n', 'num')],
        'pk': ['senderRole'],
        'rows': msgs,
        'gen_cols': {'senderRole': ['sender role', 'role', 'sender'],
                     'n': ['count', 'counts', 'number']},
    }
    return g


NONSCORABLE = {
    'REP-05': 'No "database management" course exists in the catalog (LIKE check hits unrelated titles); no valid target table. Both systems fail-closed with zero hallucinated cells.',
    'REP-07': 'Networking module exists (seed-c-04-mod-1) but zero quiz attempts exist for usr-stud-1 (all submissions quizId NULL) and quizzes are not linked to modules in the schema; no valid target table.',
}

# ---------------------------------------------------------------- table parsing
def parse_markdown_table(reply):
    lines = (reply or '').splitlines()
    blocks, cur = [], []
    for ln in lines:
        if '|' in ln:
            cur.append(ln)
        else:
            if len(cur) >= 2:
                blocks.append(cur)
            cur = []
    if len(cur) >= 2:
        blocks.append(cur)
    for b in blocks:
        if re.search(r'\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?', b[1] if len(b) > 1 else ''):
            header = [c.strip() for c in b[0].strip().strip('|').split('|')]
            rows = []
            for ln in b[2:]:
                if not re.search(r'\w', ln):
                    continue
                rows.append([c.strip() for c in ln.strip().strip('|').split('|')])
            return header, rows
    for b in blocks:
        header = [c.strip() for c in b[0].strip().strip('|').split('|')]
        if len(header) >= 2:
            rows = [[c.strip() for c in ln.strip().strip('|').split('|')] for ln in b[1:] if re.search(r'\w', ln)]
            return header, rows
    return None, []


def is_placeholder_row(cells):
    toks = [norm_text(c) for c in cells]
    if not any(toks):
        return True
    return all(t in NULL_TOKENS or t in EMPTY_TABLE_TOKENS or 'no ' in t for t in toks if t) and \
        any('no ' in t or t in EMPTY_TABLE_TOKENS or t in NULL_TOKENS for t in toks)


def map_columns(gen_header, col_synonyms):
    mapping = {}
    used = set()
    for col, syns in col_synonyms.items():
        best, best_i = None, -1
        for i, h in enumerate(gen_header):
            if i in used:
                continue
            hn = norm_text(h)
            score = 0
            for rank, s in enumerate(syns):
                if hn == s:
                    score = 100 - rank
                    break
                if s in hn or hn in s:
                    score = max(score, 50 - rank)
            if score > best_i:
                best, best_i = i, score
        if best is not None and best_i > 0:
            mapping[col] = best
            used.add(best)
    return mapping


def pk_norm(row, pk_cols, kinds):
    out = []
    for c in pk_cols:
        kind = dict(kinds).get(c, 'text')
        v = row.get(c)
        if kind == 'date':
            out.append(norm_date(v))
        elif kind == 'num':
            n = norm_num(v)
            out.append('' if n is None else str(n))
        else:
            out.append(norm_text(v))
    return tuple(out)


def score_reply(spec, reply):
    expected = spec['rows']
    kinds = dict(spec['cols'])
    header, gen_rows = parse_markdown_table(reply)
    data_rows = [r for r in gen_rows if not is_placeholder_row(r)]
    n_exp_cells = len(expected) * len(spec['cols'])
    if not expected:
        # correctly-empty ground truth: pass iff an (empty/placeholder) table
        # was actually generated. No table at all (e.g. max-iterations error)
        # is a failed report, not a correctly-empty one.
        if header is not None and not data_rows:
            return {'matched': 0, 'expected': 0, 'rate': 100.0,
                    'gen_rows': len(gen_rows), 'data_rows': 0,
                    'extra_rows': 0, 'note': 'ground truth empty; generated table correctly empty'}
        if header is None:
            return {'matched': 0, 'expected': 0, 'rate': 0.0,
                    'gen_rows': 0, 'data_rows': 0, 'extra_rows': 0,
                    'note': 'ground truth empty but no table generated (failed report)'}
        return {'matched': 0, 'expected': 0, 'rate': 0.0,
                'gen_rows': len(gen_rows), 'data_rows': len(data_rows),
                'extra_rows': len(data_rows),
                'note': 'ground truth empty but generated table claims rows (hallucinated)'}
    if header is None:
        return {'matched': 0, 'expected': n_exp_cells, 'rate': 0.0,
                'gen_rows': 0, 'data_rows': 0, 'extra_rows': 0,
                'note': 'no parseable table in reply'}
    colmap = map_columns([norm_text(h) for h in header], spec['gen_cols'])
    gen_dicts = []
    for r in data_rows:
        d = {}
        for col, idx in colmap.items():
            d[col] = r[idx] if idx < len(r) else ''
        gen_dicts.append(d)
    # Thesis-faithful alignment: a generated row joins an expected row only on
    # FULL primary-key equality. Partial-key stealing (e.g. a duplicate-PK
    # expected row grabbing a same-code different-title row) is forbidden:
    # unaligned expected rows score 0, surplus generated rows count as extra.
    ekinds = [(c, kinds[c]) for c in spec['pk']]
    exp_keys = {}
    for e in expected:
        exp_keys.setdefault(pk_norm(e, spec['pk'], spec['cols']), []).append(e)
    gen_pool = []
    for gd in gen_dicts:
        gen_pool.append((pk_norm({c: gd.get(c, '') for c in spec['pk']},
                                 spec['pk'], ekinds), gd))
    matched = 0
    for key, elist in exp_keys.items():
        for e in elist:
            hit = None
            for i, (gk, gd) in enumerate(gen_pool):
                if gk == key and all(v != '' for v in gk):
                    hit = i
                    break
            if hit is None:
                continue
            _, best = gen_pool.pop(hit)
            for col, kind in spec['cols']:
                exp_val = e.get(col)
                gen_val = best.get(col, '')
                if col == 'grade' and 'alt_grade' in e:
                    if cells_equal(exp_val, gen_val, kind) or \
                       cells_equal(e['alt_grade'], gen_val, kind):
                        matched += 1
                elif cells_equal(exp_val, gen_val, kind):
                    matched += 1
    rate = round(matched / n_exp_cells * 100, 2) if n_exp_cells else 0.0
    missing = [c for c in spec['gen_cols'] if c not in colmap]
    note = f'{matched}/{n_exp_cells} cells; table {len(header)} cols x {len(data_rows)} data rows'
    if missing:
        note += f'; unmapped expected cols: {missing}'
    if gen_pool:
        note += f'; {len(gen_pool)} extra generated row(s)'
    return {'matched': matched, 'expected': n_exp_cells, 'rate': rate,
            'gen_rows': len(data_rows), 'data_rows': len(data_rows),
            'extra_rows': len(gen_pool), 'note': note}


def verdict(rate):
    if rate is None:
        return 'non-scorable'
    if rate >= 95:
        return 'Optimal'
    if rate >= 85:
        return 'Acceptable'
    if rate >= 75:
        return 'Moderate'
    return 'Unacceptable'


def load_replies():
    wb = openpyxl.load_workbook(str(RESULTS_XLSX), read_only=True, data_only=True)
    ws = wb['Runs']
    rows = list(ws.rows)
    hdr = [c.value for c in rows[0]]
    out = {}
    for r in rows[1:]:
        d = dict(zip(hdr, [c.value for c in r]))
        if d['Sheet'] == 'Report':
            out[(d['System'], d['QueryID'])] = d['Reply'] or ''
    return out


def main(argv):
    check_only = '--check' in argv
    try:
        import pymssql  # noqa: F401
    except ImportError:
        print('FAIL: pymssql not installed (pip install pymssql)')
        return 1
    db = DB()
    try:
        fp = snapshot_fingerprint(db)
    finally:
        pass
    drift = {k: (EXPECTED_FP[k], fp[k]) for k in EXPECTED_FP if EXPECTED_FP[k] != fp[k]}
    print('snapshot fingerprint (live DB vs benchmark snapshot):')
    for k, v in fp.items():
        flag = '' if EXPECTED_FP[k] == v else '  <-- DRIFT'
        print(f'  {k:22s} live={v} expected={EXPECTED_FP[k]}{flag}')
    if drift:
        print('FAIL: snapshot drift detected; aborting (re-freeze bindings first)')
        db.close()
        return 1
    print('PASS snapshot integrity (matches 2026-09-22 benchmark state)')
    if check_only:
        db.close()
        return 0

    specs = ground_tables(db)
    db.close()
    replies = load_replies()
    qids = ['REP-01', 'REP-02', 'REP-03', 'REP-04', 'REP-06', 'REP-08', 'REP-09', 'REP-10']
    rows_out = []
    for qid in qids:
        for system in ('gabay', 'baseline'):
            s = score_reply(specs[qid], replies.get((system, qid), ''))
            v = verdict(s['rate'])
            if s['expected'] == 0:
                v = 'pass (correctly empty)' if s['rate'] == 100.0 else 'fail (no table)'
            rows_out.append({'system': system, 'qid': qid,
                             'ground': specs[qid]['sql'],
                             'exp_cells': s['expected'], 'matched': s['matched'],
                             'rate': s['rate'], 'verdict': v,
                             'gen_data_rows': s['data_rows'],
                             'extra_rows': s['extra_rows'], 'note': s['note']})
    for qid, why in NONSCORABLE.items():
        for system in ('gabay', 'baseline'):
            header, gen_rows = parse_markdown_table(replies.get((system, qid), ''))
            data_rows = [r for r in gen_rows if not is_placeholder_row(r)] if header else []
            rows_out.append({'system': system, 'qid': qid, 'ground': '(no valid target table)',
                             'exp_cells': 0, 'matched': 0, 'rate': None,
                             'verdict': 'non-scorable', 'gen_data_rows': len(data_rows),
                             'extra_rows': len(data_rows),
                             'note': why + f' | generated data rows: {len(data_rows)}'})

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'DCR'
    ws.append(['System', 'QueryID', 'GroundTruthSQL', 'ExpectedCells', 'MatchedCells',
               'DCR_Percent', 'Verdict', 'GeneratedDataRows', 'ExtraRows', 'Note'])
    for r in rows_out:
        ws.append([r['system'], r['qid'], r['ground'], r['exp_cells'], r['matched'],
                   r['rate'] if r['rate'] is not None else 'n/a', r['verdict'],
                   r['gen_data_rows'], r['extra_rows'], r['note']])
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions

    comp = wb.create_sheet('Summary')
    comp.append(['System', 'MicroDCR_cells', 'MacroDCR_mean_of_queries', 'ContentQueries',
                 'OptimalCount', 'UnacceptableCount'])
    for system in ('gabay', 'baseline'):
        sc = [r for r in rows_out if r['system'] == system and r['rate'] is not None
              and r['exp_cells'] > 0]
        micro = round(sum(r['matched'] for r in sc) / sum(r['exp_cells'] for r in sc) * 100, 2)
        macro = round(sum(r['rate'] for r in sc) / len(sc), 2)
        comp.append([system, micro, macro, len(sc),
                     sum(1 for r in sc if r['verdict'] == 'Optimal'),
                     sum(1 for r in sc if r['verdict'] == 'Unacceptable')])
    comp.append([])
    for system in ('gabay', 'baseline'):
        r09 = next(r for r in rows_out if r['system'] == system and r['qid'] == 'REP-09')
        comp.append([f'REP-09 empty-table ({system})',
                     'PASS correctly-empty' if r09['rate'] == 100.0 else 'FAIL no table generated'])
    comp.append([])
    comp.append(['Note', 'MicroDCR pools all cells (thesis formula over the 7 content Report tables with '
                         'expected cells > 0). MacroDCR is the mean of per-query rates. REP-09 (empty ground '
                         'truth) reported separately, not in means. REP-05/REP-07 non-scorable (ill-posed, no '
                         'valid target table); REP-17..REP-20 L4 refusals excluded. Thresholds: >=95 Optimal; '
                         '85-94 Acceptable; 75-84 Moderate; <75 Unacceptable.'])
    bind = wb.create_sheet('Bindings')
    bind.append(['QueryID', 'GroundTruthSQL_live', 'RowCount', 'ExpectedCells'])
    for qid in qids:
        bind.append([qid, specs[qid]['sql'], len(specs[qid]['rows']),
                     len(specs[qid]['rows']) * len(specs[qid]['cols'])])
    wb.save(str(OUT_XLSX))
    print(f'\nwrote {OUT_XLSX} ({len(rows_out)} rows)')
    print(f"{'qid':8s} {'gabay':>7s} {'baseline':>8s}  verdicts(g/b)")
    byq = {}
    for r in rows_out:
        byq.setdefault(r['qid'], {})[r['system']] = r
    for qid in ['REP-01', 'REP-02', 'REP-03', 'REP-04', 'REP-05', 'REP-06',
                'REP-07', 'REP-08', 'REP-09', 'REP-10']:
        g, b = byq[qid]['gabay'], byq[qid]['baseline']
        gs = 'n/a' if g['rate'] is None else f"{g['rate']:.1f}"
        bs = 'n/a' if b['rate'] is None else f"{b['rate']:.1f}"
        print(f'{qid:8s} {gs:>7s} {bs:>8s}  {g["verdict"]}/{b["verdict"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
