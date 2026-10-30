import React from 'react';
import type { OfficialSyllabusData, ReferenceItem, ReferenceType } from '../../../../../shared/data/syllabusData';
import { formatApa7Reference } from '../../../../../shared/data/syllabusData';
import { BookOpen, Plus, Trash2, Book, FileText, Globe } from 'lucide-react';

interface Step6GradingPoliciesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step6GradingPolicies: React.FC<Step6GradingPoliciesProps> = ({ data, onChange }) => {
  const { references = [] } = data;

  const detectType = (ref: ReferenceItem): ReferenceType => {
    if (ref.type) return ref.type;
    const text = `${ref.citation || ''} ${ref.doiOrPublisher || ''}`.toLowerCase();
    if (text.includes('http') || text.includes('www.') || text.includes('.com') || text.includes('.org') || text.includes('.edu')) {
      return 'website';
    }
    if (text.includes('journal') || text.includes('review') || text.includes('vol.') || ref.journal || ref.volume) {
      return 'journal';
    }
    return 'book';
  };

  const addReference = (initialType: ReferenceType = 'book') => {
    const newRef: ReferenceItem = {
      type: initialType,
      authors: '',
      year: '',
      title: '',
      edition: '',
      publisher: '',
      journal: '',
      volume: '',
      issue: '',
      pages: '',
      websiteName: '',
      url: '',
      citation: '',
      doiOrPublisher: ''
    };
    newRef.citation = formatApa7Reference(newRef);
    onChange({
      ...data,
      references: [...references, newRef]
    });
  };

  const updateRefField = (index: number, patch: Partial<ReferenceItem>) => {
    const updated = references.map((r, i) => {
      if (i !== index) return r;
      const currentType = patch.type || r.type || detectType(r);
      const merged: ReferenceItem = {
        ...r,
        type: currentType,
        ...patch
      };

      // Auto-compute APA 7th formatted citation unless custom citation was explicitly updated
      if (!('citation' in patch)) {
        merged.citation = formatApa7Reference(merged);
      }
      merged.year = merged.year || r.year || '';
      merged.doiOrPublisher = merged.publisher || merged.journal || merged.websiteName || merged.url || r.doiOrPublisher || '';

      return merged;
    });

    onChange({
      ...data,
      references: updated
    });
  };

  const removeReference = (index: number) => {
    const updated = references.filter((_, i) => i !== index);
    onChange({
      ...data,
      references: updated
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <span>Part V: References &amp; Reading Materials</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          APA 7th edition reference list with dedicated formats for Books, Websites, and Journal Articles.
        </p>
      </div>

      {/* Part V References */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Prescribed Textbooks &amp; Academic References</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Add books, accredited journal articles, or online references aligned with DMMMSU-INS-F003 Part V.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => addReference('book')}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer"
              title="Add Book Citation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Book</span>
            </button>
            <button
              type="button"
              onClick={() => addReference('journal')}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-all cursor-pointer"
              title="Add Journal Article Citation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Journal</span>
            </button>
            <button
              type="button"
              onClick={() => addReference('website')}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-all cursor-pointer"
              title="Add Website Reference"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Website</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {references.map((ref, idx) => {
            const currentType = detectType(ref);

            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-muted/20 space-y-3.5 transition-all"
              >
                {/* Header: Reference Index, Format Selector & Delete */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground">APA 7th Format:</span>

                    {/* Format Type Selector Tabs */}
                    <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border">
                      <button
                        type="button"
                        onClick={() => updateRefField(idx, { type: 'book' })}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          currentType === 'book'
                            ? 'bg-background text-primary shadow-xs font-bold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-pressed={currentType === 'book'}
                      >
                        <Book className="w-3 h-3" />
                        <span>Book</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateRefField(idx, { type: 'journal' })}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          currentType === 'journal'
                            ? 'bg-background text-primary shadow-xs font-bold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-pressed={currentType === 'journal'}
                      >
                        <FileText className="w-3 h-3" />
                        <span>Journal Article</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateRefField(idx, { type: 'website' })}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          currentType === 'website'
                            ? 'bg-background text-primary shadow-xs font-bold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-pressed={currentType === 'website'}
                      >
                        <Globe className="w-3 h-3" />
                        <span>Website</span>
                      </button>
                    </div>
                  </div>

                  {references.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeReference(idx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove reference"
                      aria-label={`Remove reference ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Form Fields: Adapted per APA 7th Edition Type */}
                {currentType === 'book' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Author(s) (Surname, Initial(s))
                        </label>
                        <input
                          type="text"
                          value={ref.authors ?? ''}
                          onChange={e => updateRefField(idx, { authors: e.target.value })}
                          placeholder="e.g. Laplante, P. or Dalkir, K."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Year
                        </label>
                        <input
                          type="text"
                          value={ref.year ?? ''}
                          onChange={e => updateRefField(idx, { year: e.target.value })}
                          placeholder="e.g. 2023"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Book Title
                        </label>
                        <input
                          type="text"
                          value={ref.title ?? ''}
                          onChange={e => updateRefField(idx, { title: e.target.value })}
                          placeholder="e.g. What Every Engineer Should Know About Software Engineering"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Edition / Vol. (Optional)
                        </label>
                        <input
                          type="text"
                          value={ref.edition ?? ''}
                          onChange={e => updateRefField(idx, { edition: e.target.value })}
                          placeholder="e.g. 3rd ed. or Vol. 4"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Publisher
                        </label>
                        <input
                          type="text"
                          value={ref.publisher || ref.doiOrPublisher || ''}
                          onChange={e => updateRefField(idx, { publisher: e.target.value })}
                          placeholder="e.g. CRC Press or MIT Press"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          DOI or URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={ref.url || ''}
                          onChange={e => updateRefField(idx, { url: e.target.value })}
                          placeholder="e.g. https://doi.org/10.1201/9781003306894"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentType === 'journal' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Author(s) (Surname, Initial(s))
                        </label>
                        <input
                          type="text"
                          value={ref.authors ?? ''}
                          onChange={e => updateRefField(idx, { authors: e.target.value })}
                          placeholder="e.g. Nonaka, I., & Takeuchi, H."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Year
                        </label>
                        <input
                          type="text"
                          value={ref.year ?? ''}
                          onChange={e => updateRefField(idx, { year: e.target.value })}
                          placeholder="e.g. 2007"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Article Title
                        </label>
                        <input
                          type="text"
                          value={ref.title ?? ''}
                          onChange={e => updateRefField(idx, { title: e.target.value })}
                          placeholder="e.g. The knowledge-creating company"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Journal / Periodical Name
                        </label>
                        <input
                          type="text"
                          value={ref.journal || ''}
                          onChange={e => updateRefField(idx, { journal: e.target.value })}
                          placeholder="e.g. Harvard Business Review"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Volume
                        </label>
                        <input
                          type="text"
                          value={ref.volume || ''}
                          onChange={e => updateRefField(idx, { volume: e.target.value })}
                          placeholder="e.g. 85"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Issue (Opt.)
                        </label>
                        <input
                          type="text"
                          value={ref.issue || ''}
                          onChange={e => updateRefField(idx, { issue: e.target.value })}
                          placeholder="e.g. 7/8"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Pages
                        </label>
                        <input
                          type="text"
                          value={ref.pages || ''}
                          onChange={e => updateRefField(idx, { pages: e.target.value })}
                          placeholder="e.g. 162-171"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          DOI or URL (Opt.)
                        </label>
                        <input
                          type="text"
                          value={ref.url || ''}
                          onChange={e => updateRefField(idx, { url: e.target.value })}
                          placeholder="e.g. https://doi.org/..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentType === 'website' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Author or Organization
                        </label>
                        <input
                          type="text"
                          value={ref.authors ?? ''}
                          onChange={e => updateRefField(idx, { authors: e.target.value })}
                          placeholder="e.g. ASEAN Foundation or World Health Organization"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Year or Date
                        </label>
                        <input
                          type="text"
                          value={ref.year ?? ''}
                          onChange={e => updateRefField(idx, { year: e.target.value })}
                          placeholder="e.g. 2024 or n.d."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Webpage / Document Title
                        </label>
                        <input
                          type="text"
                          value={ref.title ?? ''}
                          onChange={e => updateRefField(idx, { title: e.target.value })}
                          placeholder="e.g. Introduction to Knowledge Management"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Website Name / Platform
                        </label>
                        <input
                          type="text"
                          value={ref.websiteName || ref.doiOrPublisher || ''}
                          onChange={e => updateRefField(idx, { websiteName: e.target.value })}
                          placeholder="e.g. ASEAN Foundation"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        URL / Web Link
                      </label>
                      <input
                        type="text"
                        value={ref.url || ''}
                        onChange={e => updateRefField(idx, { url: e.target.value })}
                        placeholder="e.g. https://www.aseanfoundation.org/documents/..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Live Formatted APA 7th Citation Output */}
                <div className="p-3 rounded-lg bg-card border border-border/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      Formatted APA 7th Edition Citation
                    </span>
                    <span className="text-[10px] text-muted-foreground">Live generated for Part V</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed italic select-all pl-1">
                    {ref.citation || formatApa7Reference(ref)}
                  </p>
                  <div className="pt-1 border-t border-border/40">
                    <label className="text-[10px] text-muted-foreground block mb-0.5">
                      Citation Override / Custom String (Optional):
                    </label>
                    <input
                      type="text"
                      value={ref.citation ?? ''}
                      onChange={e => updateRefField(idx, { citation: e.target.value })}
                      placeholder="Paste complete APA 7 citation or override..."
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
