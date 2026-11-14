import React, { useState, useEffect, useRef } from 'react';
import { db, VocabFolder, VocabItem } from '../lib/db';
import { FolderPlus, Download, Upload, Folder, Search, Trash2 } from 'lucide-react';

interface VocabManagerProps {
  userId: string;
}

export const VocabManager: React.FC<VocabManagerProps> = ({ userId }) => {
  const [folders, setFolders] = useState<VocabFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [items, setItems] = useState<VocabItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    const userFolders = await db.vocabFolders.where('userId').equals(userId).toArray();
    setFolders(userFolders);

    const allItems = await db.vocabItems.where('userId').equals(userId).reverse().sortBy('createdAt');
    setItems(allItems);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  // 1. Tạo thư mục từ vựng riêng
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    await db.vocabFolders.add({
      id: crypto.randomUUID(),
      userId,
      name: trimmed,
      color: '#9D84B7', // Tím hoa tử đằng
      createdAt: Date.now(),
    });
    setNewFolderName('');
    await loadData();
  };

  // 2. Xuất từ vựng ra CSV (UTF-8 BOM) hoặc JSON
  const handleExport = (format: 'csv' | 'json') => {
    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      alert('Không có từ vựng nào trong mục đang chọn để xuất.');
      return;
    }

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
      filename = `diantuha_vocab_${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      const headers = ['Từ vựng', 'Nguyên thể', 'Phát âm', 'Nghĩa tiếng Việt', 'Từ loại', 'Ngữ pháp', 'Ví dụ Hàn', 'Dịch ví dụ', 'Ghi chú'];
      const escapeCSV = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;

      const rows = filtered.map((item) =>
        [
          item.word,
          item.lemma,
          item.pronunciation,
          item.meaning,
          item.pos,
          item.grammar,
          item.exampleKo,
          item.exampleVi,
          item.personalNote,
        ]
          .map(escapeCSV)
          .join(',')
      );

      // Thêm \uFEFF (UTF-8 BOM) để Excel mở tiếng Hàn và tiếng Việt chuẩn xác
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      filename = `diantuha_vocab_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 3. Bổ sung (Import) từ vựng từ file CSV hoặc JSON vào thư mục đang chọn
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetFolderId =
      selectedFolderId === 'all' ? folders[0]?.id || `default_${userId}` : selectedFolderId;

    try {
      const text = await file.text();
      const now = Date.now();
      const importedItems: VocabItem[] = [];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('File JSON phải là một mảng danh sách từ vựng.');
        for (const row of parsed) {
          if (!row.word || !row.meaning) continue;
          importedItems.push({
            id: crypto.randomUUID(),
            userId,
            folderId: targetFolderId,
            word: String(row.word),
            lemma: String(row.lemma || row.word),
            pronunciation: String(row.pronunciation || ''),
            meaning: String(row.meaning),
            pos: String(row.pos || 'Danh từ'),
            grammar: row.grammar ? String(row.grammar) : undefined,
            exampleKo: row.exampleKo ? String(row.exampleKo) : undefined,
            exampleVi: row.exampleVi ? String(row.exampleVi) : undefined,
            personalNote: row.personalNote ? String(row.personalNote) : undefined,
            masteryLevel: 1,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        // Xử lý CSV cơ bản (bỏ qua dòng tiêu đề đầu tiên)
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
          if (!cols[0] || !cols[3]) continue;
          importedItems.push({
            id: crypto.randomUUID(),
            userId,
            folderId: targetFolderId,
            word: cols[0],
            lemma: cols[1] || cols[0],
            pronunciation: cols[2] || '',
            meaning: cols[3],
            pos: cols[4] || '',
            grammar: cols[5] || '',
            exampleKo: cols[6] || '',
            exampleVi: cols[7] || '',
            personalNote: cols[8] || '',
            masteryLevel: 1,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (importedItems.length === 0) {
        throw new Error('Không tìm thấy dòng từ vựng hợp lệ nào (cần tối thiểu cột Từ vựng và Nghĩa).');
      }

      await db.vocabItems.bulkAdd(importedItems);
      await loadData();
      alert(`Đã nhập thành công ${importedItems.length} từ vựng vào thư mục!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi đọc file từ vựng.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFilteredItems = () => {
    return items.filter((item) => {
      const matchFolder = selectedFolderId === 'all' || item.folderId === selectedFolderId;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        item.word.toLowerCase().includes(q) ||
        item.lemma.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q);
      return matchFolder && matchSearch;
    });
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-screen bg-[#161817] text-[#F4EFE6] p-4 md:p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* CỘT TRÁI: QUẢN LÝ THƯ MỤC TỪ VỰNG */}
        <aside className="bg-[#1F2421] p-4 rounded-xl border border-[#5C4033] space-y-4 h-fit">
          <h2 className="text-lg font-serif font-semibold text-[#F4EFE6]">Thư mục từ vựng</h2>

          <form onSubmit={handleCreateFolder} className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Tên thư mục mới..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#161817] border border-[#5C4033] text-[#F4EFE6] focus:outline-none focus:border-[#9D84B7]"
            />
            <button
              type="submit"
              title="Tạo thư mục"
              className="p-2 rounded-lg bg-[#4A6B53] text-white hover:bg-[#3d5945]"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </form>

          <nav className="space-y-1">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                selectedFolderId === 'all' ? 'bg-[#4A6B53] text-white' : 'hover:bg-[#161817] text-[#F4EFE6]/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <Folder className="w-4 h-4" /> Tất cả từ vựng
              </span>
              <span className="text-xs opacity-75">{items.length}</span>
            </button>

            {folders.map((folder) => {
              const count = items.filter((i) => i.folderId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                    selectedFolderId === folder.id
                      ? 'bg-[#4A6B53] text-white'
                      : 'hover:bg-[#161817] text-[#F4EFE6]/80'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4" style={{ color: folder.color }} />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="text-xs opacity-75">{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* CỘT PHẢI: DANH SÁCH TỪ VỰNG & IMPORT/EXPORT */}
        <section className="md:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1F2421] p-4 rounded-xl border border-[#5C4033]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#F4EFE6]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ tiếng Hàn, nguyên thể hoặc nghĩa Việt..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#161817] border border-[#5C4033] text-[#F4EFE6] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm rounded-lg bg-[#9D84B7]/20 text-[#9D84B7] border border-[#9D84B7]/40 hover:bg-[#9D84B7]/30"
              >
                <Upload className="w-4 h-4" />
                <span>Nhập file (CSV/JSON)</span>
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm rounded-lg bg-[#4A6B53] text-white hover:bg-[#3d5945]"
              >
                <Download className="w-4 h-4" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#1F2421] border border-[#5C4033]/70 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xl font-bold text-[#F4EFE6]">{item.word}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#161817] text-[#9D84B7]">
                      {item.pos || 'Từ vựng'}
                    </span>
                  </div>
                  {item.lemma && item.lemma !== item.word && (
                    <p className="text-xs text-[#F4EFE6]/60">Nguyên thể: {item.lemma}</p>
                  )}
                  <p className="mt-2 text-base font-medium text-[#A3C9A8]">{item.meaning}</p>
                  {item.exampleKo && (
                    <p className="mt-2 text-xs italic text-[#F4EFE6]/75 border-l-2 border-[#5C4033] pl-2">
                      {item.exampleKo}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#5C4033]/30 flex justify-end">
                  <button
                    onClick={async () => {
                      await db.vocabItems.delete(item.id);
                      await loadData();
                    }}
                    className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};