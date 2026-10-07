#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

USER_AGENT='BasketballGoalManager-CalendarAutoFetch/0.8.0'
LIST_URL='https://registcourse.thu.edu.tw/web/news/list.php?page={page}'
BASE='https://registcourse.thu.edu.tw/'
CAL_TITLE_RX=re.compile(r'(?:本校)?(?P<year>\d{3})\s*學年度行事曆')
PDF_RX=re.compile(r'\.pdf(?:$|\?)',re.I)
DATE_WEEKDAY_RX=re.compile(r'(?<!\d)(?P<start>\d{1,2})(?:\s*[~～\-]\s*(?P<end>\d{1,2}))?\s+(?:一|二|三|四|五|六|日)(?:\s*[~～\-]\s*(?:一|二|三|四|五|六|日))?\s+(?P<title>.+)$')
MONTH_RX=re.compile(r'([一二三四五六七八九十]{1,2})\s*月')
SEMESTER_RX=re.compile(r'(?P<year>\d{3})\s*學年度第\s*(?P<term>[12])\s*學期')
IMPORTANT_RX=re.compile('|'.join([
    r'第\s*[12]\s*學期上課開始',r'中秋節',r'教師節',r'國慶日',r'臺灣光復',r'全校運動大會',r'校慶紀念日',
    r'期中考試週',r'地方公職人員選舉',r'下午停課',r'行憲紀念日',r'學期考試週',r'開國紀念日',r'彈性學習週',
    r'寒假開始',r'學年度第\s*1\s*學期終了',r'學年度第\s*2\s*學期開始',r'春節年假',r'寒假結束',r'和平紀念日',
    r'調整放假一天',r'兒童節',r'民族掃墓節',r'勞動節',r'畢業典禮',r'端午節',r'暑假開始',r'學年度終了'
]))

MONTHS={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}

class Links(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.items=[]; self._href=None; self._buf=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='a': self._href=dict(attrs).get('href'); self._buf=[]
    def handle_data(self,data):
        if self._href is not None:self._buf.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=='a' and self._href is not None:
            text=' '.join(''.join(self._buf).split())
            self.items.append((self._href,text)); self._href=None; self._buf=[]

def fetch_bytes(url:str)->bytes:
    req=Request(url,headers={'User-Agent':USER_AGENT,'Accept':'*/*'})
    with urlopen(req,timeout=35) as r:
        data=r.read(12_000_000)
        if not data: raise RuntimeError('empty response')
        return data

def fetch_text(url:str)->str:
    data=fetch_bytes(url)
    for enc in ('utf-8','big5','cp950'):
        try:return data.decode(enc)
        except UnicodeDecodeError:pass
    return data.decode('utf-8','replace')

def discover_latest():
    found=[]
    for page in range(1,4):
        html=fetch_text(LIST_URL.format(page=page)); p=Links();p.feed(html)
        for href,text in p.items:
            m=CAL_TITLE_RX.search(text)
            if m:found.append((int(m.group('year')),urljoin(BASE,href),text))
    if not found:raise RuntimeError('calendar announcement not found')
    found.sort(reverse=True)
    return found[0]

def discover_pdf(detail_url:str):
    html=fetch_text(detail_url);p=Links();p.feed(html)
    candidates=[]
    for href,text in p.items:
        full=urljoin(detail_url,href)
        if PDF_RX.search(full) and ('行事曆' in text or 'calendar' in text.lower()):candidates.append(full)
    if not candidates:
        for href,text in p.items:
            full=urljoin(detail_url,href)
            if PDF_RX.search(full):candidates.append(full)
    if not candidates:raise RuntimeError('calendar PDF attachment not found')
    return candidates[0]

def pdf_layout_text(pdf:bytes)->str:
    with tempfile.TemporaryDirectory() as td:
        src=Path(td)/'calendar.pdf';src.write_bytes(pdf)
        try:
            cp=subprocess.run(['pdftotext','-layout',str(src),'-'],capture_output=True,check=True)
        except FileNotFoundError as e:raise RuntimeError('pdftotext not installed') from e
        text=cp.stdout.decode('utf-8','replace')
        if len(text)<500:raise RuntimeError('calendar PDF text extraction too short')
        return text

def clean_title(s:str)->str:
    s=' '.join(str(s).replace('\u3000',' ').split())
    s=re.sub(r'\s*（\s*','（',s);s=re.sub(r'\s*）\s*','）',s)
    return s.strip(' ｜|')

def classify(title:str)->str:
    if any(k in title for k in ['放假','補假','開國紀念日','和平紀念日','中秋節','教師節','國慶日','行憲紀念日','兒童節','掃墓節','勞動節','端午節','春節年假']):return 'holiday'
    if '考試週' in title:return 'exam'
    if '下午停課' in title:return 'special'
    return 'school'

def date_iso(academic_year:int,month:int,day:int)->str:
    start_year=academic_year+1911
    year=start_year if month>=8 else start_year+1
    return f'{year:04d}-{month:02d}-{day:02d}'

def normalize_title(title:str,academic_year:int)->str:
    t=clean_title(title)
    replacements={
      '中秋節（放假一天）':'中秋節｜放假一天','孔子誕辰紀念日、教師節（放假一天）':'孔子誕辰紀念日、教師節｜放假一天',
      '國慶日（放假一天）':'國慶日｜放假一天','國慶日（補假一天）':'國慶日補假｜放假一天',
      '臺灣光復暨金門古寧頭大捷紀念日（放假一天）':'臺灣光復暨金門古寧頭大捷紀念日｜放假一天',
      '臺灣光復暨金門古寧頭大捷紀念日（補假一天）':'臺灣光復暨金門古寧頭大捷紀念日補假',
      '全校運動大會（停課、照常上班）':'全校運動大會｜停課、照常上班','校慶紀念日（停課、照常上班）':'校慶紀念日｜停課、照常上班',
      '行憲紀念日、聖誕節（放假一天）':'行憲紀念日、聖誕節｜放假一天','開國紀念日（放假一天）':'開國紀念日｜放假一天',
      '和平紀念日（放假一天）':'和平紀念日｜放假一天','和平紀念日（補假一天）':'和平紀念日補假',
      '兒童節（放假一天）':'兒童節｜放假一天','民族掃墓節（放假一天）':'民族掃墓節｜放假一天','兒童節（補假一天）':'兒童節補假',
      '勞動節（放假一天）':'勞動節｜放假一天','勞動節（補假一天）':'勞動節補假','畢業典禮（停課、照常上班）':'畢業典禮｜停課、照常上班',
      '端午節（放假一天）':'端午節｜放假一天'
    }
    return replacements.get(t,t)

def parse_layout(text:str,academic_year:int):
    current_month=None;events=[];seen=set()
    for raw in text.splitlines():
        line=' '.join(raw.replace('\u3000',' ').split())
        if not line:continue
        compact=line.replace(' ','')
        mm=re.search(r'(十二|十一|十|九|八|七|六|五|四|三|二|一)月',compact)
        if mm and mm.group(1) in MONTHS:current_month=MONTHS[mm.group(1)]
        if not current_month or not IMPORTANT_RX.search(line):continue
        matches=list(DATE_WEEKDAY_RX.finditer(line))
        if not matches:continue
        # Layout rows can contain mini-calendar numbers at the left; the last date+weekday before the text is the event row.
        m=matches[-1];title=clean_title(m.group('title'))
        if not IMPORTANT_RX.search(title):continue
        start=int(m.group('start'));end=int(m.group('end') or start)
        def add(day,title2):
            try:d=date_iso(academic_year,current_month,day)
            except Exception:return
            k=(d,title2)
            if k in seen:return
            seen.add(k);events.append({'date':d,'title':title2,'type':classify(title2),'meta':f'東海大學 {academic_year} 學年度｜自動同步'})
        nt=normalize_title(title,academic_year)
        if '期中考試週' in nt:
            add(start,'期中考試週開始');
            if end!=start:add(end,'期中考試週結束')
        elif re.search(r'(?<!期中)學期考試週',nt):
            add(start,'學期考試週開始');
            if end!=start:add(end,'學期考試週結束')
        elif '彈性學習週' in nt:add(start,'彈性學習週開始')
        elif '春節年假' in nt:add(start,'春節年假開始')
        elif '學年度第 1 學期終了' in nt or '學年度第1學期終了' in nt:add(start,f'{academic_year}學年度第1學期終了')
        elif '學年度第 2 學期開始' in nt or '學年度第2學期開始' in nt:add(start,f'{academic_year}學年度第2學期開始')
        elif re.search(rf'{academic_year}\s*學年度終了',nt):add(start,f'{academic_year}學年度終了')
        else:add(start,nt)
    events.sort(key=lambda x:(x['date'],x['title']))
    return events

def validate(events,academic_year:int,old_count:int=0):
    if len(events)<20:raise RuntimeError(f'calendar parse too small: {len(events)}')
    ids=[(x['date'],x['title']) for x in events]
    if len(ids)!=len(set(ids)):raise RuntimeError('calendar duplicate rows')
    titles='\n'.join(x['title'] for x in events)
    must=['第1學期上課開始','第2學期上課開始','寒假開始','暑假開始']
    missing=[x for x in must if x not in titles]
    if missing:raise RuntimeError('calendar key milestones missing: '+','.join(missing))
    if old_count and len(events)<max(20,int(old_count*.50)):raise RuntimeError(f'destructive calendar shrink old={old_count} new={len(events)}')
    if old_count and len(events)>old_count*2.5:raise RuntimeError(f'calendar expansion suspicious old={old_count} new={len(events)}')

def atomic_json(path:Path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    json.loads(tmp.read_text(encoding='utf-8'));tmp.replace(path)

def self_test():
    sample='''東海大學 115 學年度第 1 學期行事曆\n九 月\n  14 一  第 1 學期上課開始\n  28 一  中秋節（放假一天）\n十 一 月\n  3~9 二~一 期中考試週\n一 月\n 18 一 寒假開始\n東海大學 115 學年度第 2 學期行事曆\n二 月\n 22 一 第 2 學期上課開始\n六 月\n 28 一 暑假開始\n'''
    rows=parse_layout(sample,115)
    assert any(x['date']=='2026-09-14' and '第1學期上課開始' in x['title'].replace(' ','') for x in rows)
    assert any(x['date']=='2026-11-03' and x['title']=='期中考試週開始' for x in rows)
    assert any(x['date']=='2026-11-09' and x['title']=='期中考試週結束' for x in rows)
    assert any(x['date']=='2027-02-22' and '第2學期上課開始' in x['title'].replace(' ','') for x in rows)
    print('CALENDAR_SELF_TEST_OK',len(rows))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',default='.');ap.add_argument('--self-test',action='store_true');args=ap.parse_args()
    if args.self_test:self_test();return 0
    repo=Path(args.repo).resolve();data_path=repo/'data/school-calendar.json';meta_path=repo/'data/school-calendar-meta.json'
    old=json.loads(data_path.read_text(encoding='utf-8')) if data_path.exists() else []
    academic_year,detail_url,title=discover_latest();pdf_url=discover_pdf(detail_url);pdf=fetch_bytes(pdf_url);layout=pdf_layout_text(pdf)
    events=parse_layout(layout,academic_year);validate(events,academic_year,len(old) if isinstance(old,list) else 0)
    checked=datetime.now(timezone.utc).isoformat().replace('+00:00','Z');sha=hashlib.sha256(pdf).hexdigest()
    meta={'schemaVersion':1,'academicYear':academic_year,'announcementTitle':title,'sourceAnnouncementUrl':detail_url,'sourcePdfUrl':pdf_url,'checkedAt':checked,'updatedAt':checked,'eventCount':len(events),'pdfSha256':sha,'parseMethod':'pdftotext-layout-v1','status':'ok'}
    atomic_json(data_path,events);atomic_json(meta_path,meta)
    print(f'CALENDAR_AUTOFETCH_OK academicYear={academic_year} events={len(events)} pdfSha256={sha[:12]}')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
