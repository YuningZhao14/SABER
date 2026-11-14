import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dexie, { Table } from 'dexie';
import {
  BookMarked, BookOpen, CheckCircle2, Download, ExternalLink, Folder, FolderPlus,
  Globe, Layers, Plus, Search, Trash2, Upload, X,
} from 'lucide-react';

type StudyLevel = 'so-cap-1' | 'so-cap-2' | 'trung-cap-3' | 'trung-cap-4' | 'van-hoc' | 'custom';
type EntryType = 'vocab' | 'grammar';

interface VocabFolder {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: number;
}
interface VocabRecord {
  id: string;
  userId: string;
  folderId: string;
  packLevel: StudyLevel;
  entryType: EntryType;
  term: string;
  lemma: string;
  pronunciation: string;
  meaning: string;
  pos: string;
  grammarExplanation?: string;
  exampleKo?: string;
  exampleVi?: string;
  personalNote?: string;
  createdAt: number;
}
interface PackItem extends Omit<VocabRecord, 'id' | 'userId' | 'folderId' | 'createdAt'> {}
interface CurriculumPack {
  id: StudyLevel;
  badge: string;
  title: string;
  subtitle: string;
  items: PackItem[];
}

class VocabHubDB extends Dexie {
  folders!: Table<VocabFolder, string>;
  records!: Table<VocabRecord, string>;
  downloadedPacks!: Table<{ id: string; userId: string; downloadedAt: number }, string>;
  constructor() {
    super('DiAnTuHa_VocabHub_v2_3');
    this.version(1).stores({
      folders: 'id, userId, name, createdAt',
      records: 'id, userId, folderId, packLevel, entryType, term, lemma, createdAt',
      downloadedPacks: '[userId+id], userId, id, downloadedAt',
    });
  }
}
const db = new VocabHubDB();
const uid = () => globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// These are illustrative starter entries, not a complete curriculum pack or Naver data dump.
const STARTER_PACKS: CurriculumPack[] = [
  { id: 'so-cap-1', badge: 'Sơ cấp 1', title: 'Từ vựng & ngữ pháp sơ cấp 1', subtitle: 'Một vài mục mẫu để làm quen; bạn có thể nhập bộ dữ liệu của riêng mình.', items: [
    { packLevel: 'so-cap-1', entryType: 'vocab', term: '기다리다', lemma: '기다리다', pronunciation: '기다리다', meaning: 'chờ đợi', pos: 'Động từ', exampleKo: '친구를 기다려요.', exampleVi: 'Tôi đang đ���i bạn.' },
    { packLevel: 'so-cap-1', entryType: 'grammar', term: '-아/어서', lemma: '-아/어서', pronunciation: '아서/어서', meaning: 'vì… nên…', pos: 'Ngữ pháp sơ cấp 1', grammarExplanation: 'Gốc có nguyên âm ㅏ/ㅗ thường kết hợp với -아서; các trường hợp còn lại với -어서; 하다 → 해서.', exampleKo: '배가 아파서 병원에 갔어요.', exampleVi: 'Vì đau bụng nên tôi đã đi bệnh viện.' },
  ]},
  { id: 'so-cap-2', badge: 'Sơ cấp 2', title: 'Từ vựng & ngữ pháp sơ cấp 2', subtitle: 'Mục mẫu; không đại diện cho một danh sách chuẩn đầy đủ.', items: [
    { packLevel: 'so-cap-2', entryType: 'vocab', term: '익숙하다', lemma: '익숙하다', pronunciation: '익쑤카다', meaning: 'quen thuộc, thành thạo', pos: 'Tính từ', exampleKo: '한국 생활에 익숙해졌어요.', exampleVi: 'Tôi đã quen với cuộc sống ở Hàn Quốc.' },
    { packLevel: 'so-cap-2', entryType: 'grammar', term: '-(으)ㄴ 적이 있다/없다', lemma: '-(으)ㄴ 적이 있다', pronunciation: '은 적이 있다', meaning: 'đã từng / chưa từng', pos: 'Ngữ pháp sơ cấp 2', grammarExplanation: 'Dùng với động từ để nói về kinh nghiệm đã hoặc chưa từng trải qua.', exampleKo: '한국 소설을 읽은 적이 있어요.', exampleVi: 'Tôi đã từng đọc tiểu thuyết Hàn Quốc.' },
  ]},
  { id: 'trung-cap-3', badge: 'Trung cấp 3', title: 'Từ vựng & ngữ pháp trung cấp 3', subtitle: 'Mục mẫu để thử tính năng lưu ngoại tuyến.', items: [
    { packLevel: 'trung-cap-3', entryType: 'vocab', term: '망설이다', lemma: '망설이다', pronunciation: '망서리다', meaning: 'do dự, chần chừ', pos: 'Động từ', exampleKo: '그는 대답을 망설였다.', exampleVi: 'Anh ấy chần chừ chưa trả lời.' },
    { packLevel: 'trung-cap-3', entryType: 'grammar', term: '-는 바람에', lemma: '-는 바람에', pronunciation: '는 바람에', meaning: 'vì… nên… (nguyên nhân bất ngờ, thường dẫn đến kết quả không mong muốn)', pos: 'Ngữ pháp trung cấp 3', grammarExplanation: 'Gắn sau thân động từ; thường dùng khi kết quả là điều không mong muốn.', exampleKo: '비가 오는 바람에 늦었어요.', exampleVi: 'Vì trời mưa bất ngờ nên tôi đến muộn.' },
  ]},
  { id: 'trung-cap-4', badge: 'Trung cấp 4', title: 'Từ vựng & ngữ pháp trung cấp 4', subtitle: 'Mục mẫu; thêm dữ liệu của bạn qua tệp CSV hoặc JSON.', items: [
    { packLevel: 'trung-cap-4', entryType: 'vocab', term: '헤아리다', lemma: '헤아리다', pronunciation: '헤아리다', meaning: 'thấu hiểu, cảm thông; đong đếm', pos: 'Động từ', exampleKo: '상대방의 마음을 헤아리기란 쉽지 않다.', exampleVi: 'Thấu hiểu lòng người khác không phải điều dễ dàng.' },
    { packLevel: 'trung-cap-4', entryType: 'grammar', term: '-(으)ㄹ 법하다', lemma: '-(으)ㄹ 법하다', pronunciation: '을 법하다', meaning: 'có vẻ hợp lý / có khả năng xảy ra', pos: 'Ngữ pháp trung cấp 4', grammarExplanation: 'Diễn tả việc có cơ sở hoặc có khả năng xảy ra trong tình huống đó.', exampleKo: '그럴 법한 이야기예요.', exampleVi: 'Đó là câu chuyện nghe cũng có lý.' },
  ]},
];

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) { cells.push(value.trim()); value = ''; }
    else value += c;
  }
  cells.push(value.trim()); return cells;
}
function parseVocabFile(fileName: string, text: string): Array<Record<string, unknown>> {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('Tệp không có dữ liệu.');
  if (fileName.toLowerCase().endsWith('.json') || clean.startsWith('[') || clean.startsWith('{')) {
    const parsed: unknown = JSON.parse(clean);
    const rows = Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown[]; words?: unknown[] })?.entries || (parsed as { words?: unknown[] })?.words;
    if (!Array.isArray(rows)) throw new Error('JSON cần là một mảng hoặc có trường entries/words dạng mảng.');
    return rows.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }
  const lines = clean.split(/\r?\n/).filter(Boolean);
  const first = lines[0] || '';
  const delimiter = first.includes('\t') ? '\t' : first.includes('|') ? '|' : first.includes(';') && !first.includes(',') ? ';' : ',';
  const parsed = lines.map(line => parseCsvLine(line, delimiter));
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const header = parsed[0].map(normalize);
  const hasHeader = header.some(c => ['word','term','korean','hangul','tu tieng han','meaning','nghia tieng viet'].includes(c));
  const data = hasHeader ? parsed.slice(1) : parsed;
  if (!hasHeader && delimiter === ',' && data.some(row => row.length > 4)) {
    // Supports the common 9-column template: term, lemma, pronunciation, meaning, POS, Hanja, exampleKo, exampleVi, grammar.
    return data.map(c => ({ term: c[0], lemma: c[1], pronunciation: c[2], meaning: c[3], pos: c[4], exampleKo: c[6], exampleVi: c[7], grammarExplanation: c[8] }));
  }
  return data.map(c => hasHeader ? Object.fromEntries(header.map((h, i) => [h, c[i] || ''])) : ({ term: c[0], meaning: c[1], personalNote: c[2] }));
}
const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  return '';
};

export interface VocabAndOfflineHubProps { userId?: string; }
export const VocabAndOfflineHub: React.FC<VocabAndOfflineHubProps> = ({ userId = 'local_user_default' }) => {
  const [tab, setTab] = useState<'notebook' | 'packs'>('notebook');
  const [folders, setFolders] = useState<VocabFolder[]>([]);
  const [records, setRecords] = useState<VocabRecord[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [query, setQuery] = useState('');
  const [entryFilter, setEntryFilter] = useState<'all' | EntryType>('all');
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#588157');
  const [notice, setNotice] = useState('');
  const [naverQuery, setNaverQuery] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    let fs = await db.folders.where('userId').equals(userId).toArray();
    if (!fs.length) {
      const fallback: VocabFolder = { id: `default_${userId}`, userId, name: 'Sổ tay mặc định', color: '#4A6B53', createdAt: Date.now() };
      await db.folders.put(fallback); fs = [fallback];
    }
    setFolders(fs);
    setRecords(await db.records.where('userId').equals(userId).toArray().then(rows => rows.sort((a,b) => b.createdAt-a.createdAt)));
    setDownloaded(new Set((await db.downloadedPacks.where('userId').equals(userId).toArray()).map(x => x.id)));
  }, [userId]);
  useEffect(() => { refresh().catch(e => setNotice(`Không mở được IndexedDB: ${String(e)}`)); }, [refresh]);

  const filtered = useMemo(() => records.filter(r =>
    (selectedFolder === 'all' || r.folderId === selectedFolder) &&
    (entryFilter === 'all' || r.entryType === entryFilter) &&
    `${r.term} ${r.lemma} ${r.meaning} ${r.pos}`.toLowerCase().includes(query.toLowerCase())
  ), [records, selectedFolder, entryFilter, query]);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault(); const name = folderName.trim(); if (!name) return;
    const folder = { id: uid(), userId, name, color: folderColor, createdAt: Date.now() };
    await db.folders.add(folder); setFolderName(''); setSelectedFolder(folder.id); await refresh();
  };
  const deleteFolder = async (folder: VocabFolder) => {
    if (folder.id === folders[0]?.id || !window.confirm(`Xóa thư mục “${folder.name}”? Các mục từ sẽ chuyển về thư mục mặc định.`)) return;
    const fallback = folders[0]?.id; if (!fallback) return;
    await db.transaction('rw', db.folders, db.records, async () => {
      await db.records.where('folderId').equals(folder.id).modify({ folderId: fallback });
      await db.folders.delete(folder.id);
    });
    if (selectedFolder === folder.id) setSelectedFolder('all'); await refresh();
  };
  const downloadPack = async (pack: CurriculumPack) => {
    const targetFolder = folders[0]?.id || `default_${userId}`; const now = Date.now();
    const recordsToAdd: VocabRecord[] = pack.items.map(item => ({ ...item, id: uid(), userId, folderId: targetFolder, createdAt: now }));
    await db.transaction('rw', db.records, db.downloadedPacks, async () => {
      await db.records.bulkAdd(recordsToAdd);
      await db.downloadedPacks.put({ id: pack.id, userId, downloadedAt: now }, [userId, pack.id] as unknown as string);
    });
    setNotice(`${recordsToAdd.length} mục mẫu đã lưu ngoại tuyến.`); await refresh();
  };
  const removeRecord = async (record: VocabRecord) => { await db.records.delete(record.id); await refresh(); };
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const rows = parseVocabFile(file.name, await file.text());
      const targetFolder = selectedFolder === 'all' ? folders[0]?.id : selectedFolder;
      if (!targetFolder) throw new Error('Tạo thư mục trước khi nhập.');
      const now = Date.now();
      const incoming: VocabRecord[] = rows.map(row => {
        const term = pick(row, 'term','word','korean','hangul','tu tieng han','từ tiếng hàn');
        const meaning = pick(row, 'meaning','vietnamese','vi','definition','nghia tieng viet','nghĩa tiếng việt');
        const entryType: EntryType = pick(row,'entryType','entrytype').toLowerCase() === 'grammar' ? 'grammar' : 'vocab';
        return { id: uid(), userId, folderId: targetFolder, packLevel: 'custom', entryType, term,
          lemma: pick(row,'lemma','baseForm','baseform') || term,
          pronunciation: pick(row,'pronunciation','phonetic'), meaning,
          pos: pick(row,'pos','partOfSpeech','partofspeech','type') || (entryType === 'grammar' ? 'Ngữ pháp' : 'Từ vựng'),
          grammarExplanation: pick(row,'grammarExplanation','grammar','grammarNote') || undefined,
          exampleKo: pick(row,'exampleKo','example','exampleko') || undefined,
          exampleVi: pick(row,'exampleVi','exampleTranslation','examplevi') || undefined,
          personalNote: pick(row,'personalNote','note') || undefined, createdAt: now };
      }).filter(r => r.term && r.meaning);
      if (!incoming.length) throw new Error('Không tìm thấy mục có đủ term/word và meaning/nghĩa.');
      await db.records.bulkAdd(incoming); setNotice(`Đã nhập ${incoming.length} mục vào thư mục đã chọn.`); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể đọc tệp.'); }
    finally { e.target.value = ''; }
  };
  const exportRecords = (format: 'csv'|'json') => {
    const rows = selectedFolder === 'all' ? records : records.filter(r => r.folderId === selectedFolder);
    const content = format === 'json' ? JSON.stringify(rows, null, 2) : '\uFEFF' + [
      ['term','lemma','pronunciation','meaning','pos','entryType','exampleKo','exampleVi','grammarExplanation','personalNote','folderId'].join(','),
      ...rows.map(r => [r.term,r.lemma,r.pronunciation,r.meaning,r.pos,r.entryType,r.exampleKo,r.exampleVi,r.grammarExplanation,r.personalNote,r.folderId]
        .map(v => `"${String(v || '').replaceAll('"','""')}"`).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `so-tay-tu-vung.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const term = String(form.get('term') || '').trim(), meaning = String(form.get('meaning') || '').trim();
    if (!term || !meaning) return;
    await db.records.add({ id: uid(), userId, folderId: String(form.get('folderId') || folders[0]?.id), packLevel: 'custom', entryType: String(form.get('entryType')) as EntryType,
      term, lemma: String(form.get('lemma') || term), pronunciation: String(form.get('pronunciation') || ''), meaning,
      pos: String(form.get('pos') || 'Từ vựng'), grammarExplanation: String(form.get('grammar') || '') || undefined,
      exampleKo: String(form.get('exampleKo') || '') || undefined, exampleVi: String(form.get('exampleVi') || '') || undefined,
      createdAt: Date.now() }); e.currentTarget.reset(); await refresh();
  };

  return <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[#2A2E2B] bg-[#161917] p-4 text-[#F4EFE6] md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2E2B] pb-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('notebook')} className={`rounded-xl border px-4 py-2 text-sm ${tab === 'notebook' ? 'border-[#4A6B53] bg-[#253529]' : 'border-[#2E332F] bg-[#191C1A]'}`}><BookMarked className="mr-2 inline h-4 w-4"/>Sổ tay ({records.length})</button>
        <button onClick={() => setTab('packs')} className={`rounded-xl border px-4 py-2 text-sm ${tab === 'packs' ? 'border-[#4A6B53] bg-[#253529]' : 'border-[#2E332F] bg-[#191C1A]'}`}><Download className="mr-2 inline h-4 w-4"/>Gói mẫu ngoại tuyến</button>
      </div>
      <form onSubmit={addManual} className="flex flex-wrap gap-2">
        <select name="entryType" className="rounded-lg bg-[#121413] p-2 text-xs"><option value="vocab">Từ vựng</option><option value="grammar">Ngữ pháp</option></select>
        <input name="term" required placeholder="Từ / cấu trúc" className="w-36 rounded-lg border border-[#343935] bg-[#121413] px-2 py-2 text-xs"/>
        <input name="meaning" required placeholder="Nghĩa tiếng Việt" className="w-40 rounded-lg border border-[#343935] bg-[#121413] px-2 py-2 text-xs"/>
        <select name="folderId" className="max-w-40 rounded-lg bg-[#121413] p-2 text-xs">{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <input name="lemma" placeholder="Nguyên thể" className="w-28 rounded-lg border border-[#343935] bg-[#121413] px-2 py-2 text-xs"/>
        <input name="pronunciation" placeholder="Phiên âm" className="w-24 rounded-lg border border-[#343935] bg-[#121413] px-2 py-2 text-xs"/>
        <input name="pos" placeholder="Từ loại" className="w-24 rounded-lg border border-[#343935] bg-[#121413] px-2 py-2 text-xs"/>
        <button className="rounded-lg bg-[#4A6B53] px-3 py-2 text-xs"><Plus className="mr-1 inline h-4 w-4"/>Thêm</button>
      </form>
    </header>
    {tab === 'packs' ? <div className="mt-5">
      <h2 className="font-serif text-xl">Gói dữ liệu mẫu để dùng ngoại tuyến</h2><p className="mt-1 text-xs text-[#9CA19E]">Các gói bên dưới chỉ bao gồm vài mục minh họa, không phải bộ NAVER chính thức hay danh sách đủ hàng trăm từ.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{STARTER_PACKS.map(pack => <article key={pack.id} className="rounded-xl border border-[#2D322E] bg-[#1A1D1B] p-4">
        <div className="flex items-center justify-between"><span className="rounded bg-[#2D2536] px-2 py-1 text-xs text-[#C4B0DC]">{pack.badge}</span><span className="text-xs text-[#9CA19E]">{pack.items.length} mục mẫu</span></div>
        <h3 className="mt-3 font-semibold">{pack.title}</h3><p className="mt-1 text-xs text-[#9CA19E]">{pack.subtitle}</p>
        <div className="my-3 flex flex-wrap gap-2">{pack.items.map(item => <button key={item.term} onClick={() => setNaverQuery(item.lemma)} className="rounded-lg border border-[#343935] px-2 py-1 text-xs hover:border-[#9D84B7]">{item.entryType === 'grammar' ? '[NP]' : '[TV]'} {item.term}</button>)}</div>
        <button disabled={downloaded.has(pack.id)} onClick={() => downloadPack(pack)} className="w-full rounded-lg bg-[#4A6B53] px-3 py-2 text-sm disabled:bg-[#223326]"><CheckCircle2 className="mr-2 inline h-4 w-4"/>{downloaded.has(pack.id) ? 'Đã lưu ngoại tuyến' : 'Lưu gói mẫu vào IndexedDB'}</button>
      </article>)}</div>
    </div> : <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
      <aside className="h-fit rounded-xl border border-[#2A2E2B] bg-[#1A1D1B] p-4">
        <h3 className="mb-3 font-serif">Thư mục từ vựng riêng</h3><form onSubmit={createFolder} className="mb-4 space-y-2"><div className="flex gap-2"><input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Tên thư mục" className="min-w-0 flex-1 rounded-lg bg-[#121413] px-2 py-2 text-xs"/><input type="color" value={folderColor} onChange={e => setFolderColor(e.target.value)} className="h-9 w-10 rounded"/></div><button className="w-full rounded-lg border border-[#4A6B53] bg-[#253529] py-2 text-xs"><FolderPlus className="mr-1 inline h-4 w-4"/>Tạo thư mục</button></form>
        <button onClick={() => setSelectedFolder('all')} className="mb-1 flex w-full justify-between rounded-lg p-2 text-left text-sm hover:bg-[#242926]"><span><Folder className="mr-2 inline h-4 w-4"/>Tất cả</span>{records.length}</button>
        {folders.map((f,i) => <div key={f.id} className="flex items-center gap-1"><button onClick={() => setSelectedFolder(f.id)} className={`flex flex-1 justify-between rounded-lg p-2 text-left text-sm ${selectedFolder===f.id?'bg-[#4A6B53]':''}`}><span className="truncate"><Folder className="mr-2 inline h-4 w-4" style={{color:f.color}}/>{f.name}</span>{records.filter(r=>r.folderId===f.id).length}</button>{i>0&&<button title="Xóa thư mục" onClick={()=>deleteFolder(f)} className="p-2 text-red-300"><Trash2 className="h-4 w-4"/></button>}</div>)}
      </aside>
      <main className="space-y-4 md:col-span-3">
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#2A2E2B] bg-[#1A1D1B] p-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8E9490]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm từ hoặc nghĩa" className="w-full rounded-lg bg-[#121413] py-2 pl-9 pr-3 text-sm"/></div><select value={entryFilter} onChange={e=>setEntryFilter(e.target.value as 'all'|EntryType)} className="rounded-lg bg-[#121413] px-3 text-xs"><option value="all">Tất cả loại</option><option value="vocab">Từ vựng</option><option value="grammar">Ngữ pháp</option></select><input ref={importRef} type="file" accept=".csv,.tsv,.txt,.json" onChange={importFile} className="hidden"/><button onClick={()=>importRef.current?.click()} className="rounded-lg border border-[#343935] px-3 py-2 text-xs"><Upload className="mr-1 inline h-4 w-4"/>Nhập CSV/TSV/JSON</button><button onClick={()=>exportRecords('csv')} className="rounded-lg border border-[#343935] px-3 py-2 text-xs"><Download className="mr-1 inline h-4 w-4"/>Xuất CSV</button><button onClick={()=>exportRecords('json')} className="rounded-lg border border-[#343935] px-3 py-2 text-xs"><Download className="mr-1 inline h-4 w-4"/>JSON</button></div>
        {notice&&<p role="status" className="rounded-lg bg-[#223326] p-3 text-xs text-[#A3C9A8]">{notice}</p>}
        {!filtered.length?<div className="rounded-xl border border-[#2A2E2B] p-8 text-center text-sm text-[#9CA19E]"><BookOpen className="mx-auto mb-2 h-7 w-7"/>Thư mục chưa có từ. Thêm thủ công hoặc nhập tệp.</div>:<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{filtered.map(item=><article key={item.id} className="rounded-xl border border-[#2A2E2B] bg-[#1A1D1B] p-4"><div className="flex justify-between gap-2"><span className="text-xs text-[#C4B0DC]">{item.entryType==='grammar'?'Ngữ pháp':item.pos}</span><button onClick={()=>setNaverQuery(item.lemma||item.term)} className="text-xs text-[#C4B0DC]"><Globe className="mr-1 inline h-3 w-3"/>Tra Naver</button></div><h4 className="mt-2 text-lg font-bold">{item.term}</h4>{item.pronunciation&&<p className="text-xs text-[#9CA19E]">[{item.pronunciation}]</p>}<p className="mt-2 text-sm text-[#A3C9A8]">{item.meaning}</p>{item.grammarExplanation&&<p className="mt-2 rounded bg-[#1D1A22] p-2 text-xs text-[#C4B0DC]">{item.grammarExplanation}</p>}{item.exampleKo&&<p className="mt-2 text-xs">{item.exampleKo}<br/><span className="text-[#9CA19E]">{item.exampleVi}</span></p>}<div className="mt-3 flex justify-between border-t border-[#262A27] pt-2 text-xs text-[#9CA19E]"><span>{item.packLevel}</span><button onClick={()=>removeRecord(item)} className="text-red-300"><Trash2 className="mr-1 inline h-3 w-3"/>Xóa</button></div></article>)}</div>}
      </main>
    </div>}
    <div className="mt-4 flex flex-wrap gap-2 text-xs"><a className="text-[#C4B0DC] underline" href="https://korean.dict.naver.com/kovidict/#/search?query=%ED%95%9C%EA%B5%AD%EC%96%B4" target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3"/>Mở từ điển NAVER</a><span className="text-[#9CA19E]">Trang Naver có thể chặn iframe nhúng; dùng liên kết mở ngoài nếu khung không tải.</span></div>
    {naverQuery!==null&&<div className="fixed inset-0 z-50 flex justify-end bg-black/70"><section className="flex h-full w-full max-w-xl flex-col border-l border-[#343935] bg-[#161917]"><header className="flex items-center justify-between border-b border-[#2A2E2B] p-3"><strong className="truncate">Từ điển: {naverQuery}</strong><div className="flex gap-2"><a className="rounded bg-[#242926] px-3 py-2 text-xs" href={`https://korean.dict.naver.com/kovidict/#/search?query=${encodeURIComponent(naverQuery)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3 w-3"/>Mở ngoài</a><button onClick={()=>setNaverQuery(null)} className="rounded bg-[#242926] p-2"><X className="h-4 w-4"/></button></div></header><div className="border-b border-[#2A2E2B] p-3"><input value={naverQuery} onChange={e=>setNaverQuery(e.target.value)} className="w-full rounded-lg bg-[#121413] p-2 text-sm"/></div><div className="flex-1 bg-white"><iframe title="NAVER Korean-Vietnamese Dictionary" src={`https://korean.dict.naver.com/kovidict/#/search?query=${encodeURIComponent(naverQuery)}`} className="h-full w-full border-0"/></div></section></div>}
  </section>;
};
export default VocabAndOfflineHub;
