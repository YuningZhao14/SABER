import React, { useState, useEffect, useCallback } from 'react';
import { db, LocalDocument, DocumentParagraph } from '../lib/db';
import { Columns, AlignJustify, BookOpen, Sparkles, Edit3, Check, Loader2 } from 'lucide-react';

interface ParallelReaderProps {
  documentId: string;
  userId: string;
  onWordSelect?: (word: string, sentence: string) => void;
}

type ViewMode = 'ko-only' | 'split-parallel' | 'interlinear';

// Hàm tách câu tiếng Hàn chuẩn xác bằng Intl.Segmenter
function splitKoreanSentences(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text))
      .map((s) => s.segment.trim())
      .filter(Boolean);
  }
  return text.split(/(?<=[.!?。])\s+/).filter(Boolean);
}

export const ParallelReader: React.FC<ParallelReaderProps> = ({
  documentId,
  userId,
  onWordSelect,
}) => {
  const [doc, setDoc] = useState<LocalDocument | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split-parallel');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftVi, setDraftVi] = useState<string>('');
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);

  useEffect(() => {
    db.documents.get(documentId).then((found) => {
      if (found && found.userId === userId) {
        setDoc(found);
      }
    });
  }, [documentId, userId]);

  // Lưu bản dịch trực tiếp vào IndexedDB
  const saveParagraphTranslation = useCallback(
    async (index: number, newViText: string, mode: DocumentParagraph['translationMode'] = 'manual') => {
      if (!doc) return;
      const updatedParagraphs = doc.paragraphs.map((p) =>
        p.index === index
          ? { ...p, viText: newViText, translationMode: mode, updatedAt: Date.now() }
          : p
      );
      const updatedDoc: LocalDocument = {
        ...doc,
        paragraphs: updatedParagraphs,
        updatedAt: Date.now(),
      };
      await db.documents.put(updatedDoc);
      setDoc(updatedDoc);
      setEditingIdx(null);
    },
    [doc]
  );

  // Gọi API AI dịch đối chiếu giữ nguyên thứ tự từng câu
  const handleAITranslateParagraph = async (paragraph: DocumentParagraph) => {
    setTranslatingIdx(paragraph.index);
    try {
      const sentences = splitKoreanSentences(paragraph.koText);

      // Gọi endpoint backend proxy (không gọi trực tiếp từ frontend để bảo mật API Key)
      const response = await fetch('/api/ai/translate-aligned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentences,
          mode: 'literary',
          contextPrev: doc?.paragraphs[paragraph.index - 1]?.koText || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối máy chủ AI. Hãy kiểm tra mạng hoặc cấu hình API.');
      }

      const data: { alignedTranslations: string[] } = await response.json();
      const joinedVi = data.alignedTranslations.join(' ');
      await saveParagraphTranslation(paragraph.index, joinedVi, 'literary');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Lỗi dịch thuật.');
    } finally {
      setTranslatingIdx(null);
    }
  };

  if (!doc) {
    return (
      <div className="p-8 text-center text-[#9D84B7] bg-[#161817] min-h-screen">
        Đang mở cuốn sách từ thư viện cục bộ...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161817] text-[#F4EFE6] font-serif">
      {/* Thanh điều khiển nổi gọn nhẹ - Tự động thích ứng Android & Desktop */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1F2421]/95 border-b border-[#5C4033] backdrop-blur">
        <h1 className="text-base md:text-lg font-semibold text-[#F4EFE6] truncate max-w-[220px] md:max-w-md">
          {doc.title}
        </h1>

        <div className="flex items-center gap-1.5 bg-[#161817] p-1 rounded-lg border border-[#5C4033]">
          <button
            onClick={() => setViewMode('ko-only')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs md:text-sm transition ${
              viewMode === 'ko-only' ? 'bg-[#4A6B53] text-white' : 'text-[#F4EFE6]/70 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Chỉ đọc</span>
          </button>

          <button
            onClick={() => setViewMode('split-parallel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs md:text-sm transition ${
              viewMode === 'split-parallel' ? 'bg-[#4A6B53] text-white' : 'text-[#F4EFE6]/70 hover:text-white'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>Song song</span>
          </button>

          <button
            onClick={() => setViewMode('interlinear')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs md:text-sm transition ${
              viewMode === 'interlinear' ? 'bg-[#4A6B53] text-white' : 'text-[#F4EFE6]/70 hover:text-white'
            }`}
          >
            <AlignJustify className="w-4 h-4" />
            <span>Đối chiếu câu</span>
          </button>
        </div>
      </header>

      {/* Khu vực nội dung đọc */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {doc.paragraphs.map((para) => {
          const koSentences = splitKoreanSentences(para.koText);
          const viSentences = splitKoreanSentences(para.viText || '');

          return (
            <article
              key={para.index}
              className="p-4 md:p-6 rounded-xl bg-[#1F2421] border border-[#5C4033]/60 transition hover:border-[#4A6B53]"
            >
              {/* CHẾ ĐỘ 1: CHỈ ĐỌC TIẾNG HÀN */}
              {viewMode === 'ko-only' && (
                <p className="text-lg md:text-xl leading-relaxed tracking-wide text-[#F4EFE6]">
                  {para.koText}
                </p>
              )}

              {/* CHẾ ĐỘ 2: SONG SONG HAI CỘT (TRÁI HÀN - PHẢI VIỆT) */}
              {viewMode === 'split-parallel' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="text-lg leading-relaxed text-[#F4EFE6] md:border-r md:border-[#5C4033]/50 md:pr-6">
                    {koSentences.map((sent, sIdx) => (
                      <span
                        key={sIdx}
                        onClick={() => onWordSelect?.(sent, para.koText)}
                        className="cursor-pointer hover:bg-[#4A6B53]/30 rounded px-0.5 transition"
                      >
                        {sent}{' '}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col justify-between text-base leading-relaxed text-[#F4EFE6]/85">
                    {editingIdx === para.index ? (
                      <div className="space-y-2">
                        <textarea
                          value={draftVi}
                          onChange={(e) => setDraftVi(e.target.value)}
                          rows={4}
                          className="w-full p-3 rounded-lg bg-[#161817] border border-[#9D84B7] text-[#F4EFE6] focus:outline-none"
                          placeholder="Nhập bản dịch tiếng Việt của bạn..."
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingIdx(null)}
                            className="px-3 py-1 text-xs rounded bg-[#161817] text-[#F4EFE6]/70"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => saveParagraphTranslation(para.index, draftVi, 'manual')}
                            className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-[#4A6B53] text-white"
                          >
                            <Check className="w-3.5 h-3.5" /> Lưu bản dịch
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={para.viText ? 'text-[#F4EFE6]/90' : 'italic text-[#9D84B7]/70'}>
                          {para.viText || 'Chưa có bản dịch cho đoạn này.'}
                        </p>
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#5C4033]/30">
                          <button
                            onClick={() => handleAITranslateParagraph(para)}
                            disabled={translatingIdx === para.index}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-[#9D84B7]/20 text-[#9D84B7] hover:bg-[#9D84B7]/30 disabled:opacity-50"
                          >
                            {translatingIdx === para.index ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>Dịch AI đối chiếu</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingIdx(para.index);
                              setDraftVi(para.viText || '');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-[#161817] text-[#F4EFE6]/80 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Tự dịch / Sửa</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* CHẾ ĐỘ 3: ĐỐI CHIẾU TỪNG CÂU (INTERLINEAR - TỐI ƯU ANDROID) */}
              {viewMode === 'interlinear' && (
                <div className="space-y-4">
                  {koSentences.map((koSent, sIdx) => (
                    <div
                      key={sIdx}
                      className="pl-3 border-l-2 border-[#4A6B53] space-y-1"
                    >
                      <p className="text-lg leading-relaxed text-[#F4EFE6]">{koSent}</p>
                      <p className="text-sm md:text-base text-[#9D84B7]">
                        {viSentences[sIdx] || '— (Chưa có câu dịch tương ứng)'}
                      </p>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleAITranslateParagraph(para)}
                      disabled={translatingIdx === para.index}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[#4A6B53] text-white"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Dịch đối chiếu từng câu</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
};