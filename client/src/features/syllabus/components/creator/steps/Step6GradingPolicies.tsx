import React, { useState } from 'react';
import type { OfficialSyllabusData, ReferenceItem, ReferenceType } from '../../../../../shared/data/syllabusData';
import { formatApa7Reference } from '../../../../../shared/data/syllabusData';
import { RequiredMark } from '../RequiredMark';
import { BookOpen, Plus, Trash2, Book, FileText, Globe, Pencil } from 'lucide-react';

interface Step6GradingPoliciesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step6GradingPolicies: React.FC<Step6GradingPoliciesProps> = ({ data, onChange }) => {
  const { references = [] } = data;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [referenceType, setReferenceType] = useState<ReferenceType>('book');
  const [formData, setFormData] = useState<ReferenceItem>({
    type: 'book',
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
  });

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

  const startNewReference = (type: ReferenceType = 'book') => {
    setReferenceType(type);
    setFormData({
      type,
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
    });
    setEditingIndex(null);
  };

  const editReference = (index: number) => {
    const ref = references[index];
    const type = detectType(ref);
    setReferenceType(type);
    setFormData({ ...ref, type });
    setEditingIndex(index);
  };

  const saveReference = () => {
    const citation = formatApa7Reference(formData);
    const updatedRef: ReferenceItem = {
      ...formData,
      citation,
      doiOrPublisher: formData.publisher || formData.journal || formData.websiteName || formData.url || ''
    };

    let updated;
    if (editingIndex !== null) {
      updated = references.map((r, i) => i === editingIndex ? updatedRef : r);
    } else {
      updated = [...references, updatedRef];
    }

    onChange({ ...data, references: updated });
    setEditingIndex(null);
    setFormData({
      type: 'book',
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
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setFormData({
      type: 'book',
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
    });
  };

  const removeReference = (index: number) => {
    const updated = references.filter((_, i) => i !== index);
    onChange({ ...data, references: updated });
    if (editingIndex === index) {
      cancelEdit();
    }
  };

  const updateFormData = (field: keyof ReferenceItem, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
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
        </div>

        {/* Single Reference Form Area */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground">
              {editingIndex !== null ? `Edit Reference #${editingIndex + 1}` : 'Add New Reference'}
            </h4>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Reference Type Selector */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border">
            <button
              type="button"
              onClick={() => {
                setReferenceType('book');
                updateFormData('type', 'book');
              }}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                referenceType === 'book'
                  ? 'bg-background text-primary shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Book className="w-3.5 h-3.5" />
              <span>Book</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReferenceType('journal');
                updateFormData('type', 'journal');
              }}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                referenceType === 'journal'
                  ? 'bg-background text-primary shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Journal Article</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReferenceType('website');
                updateFormData('type', 'website');
              }}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                referenceType === 'website'
                  ? 'bg-background text-primary shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </button>
          </div>

          {/* Form Fields Based on Type */}
          {referenceType === 'book' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Author(s) (Surname, Initial(s))</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.authors}
                    onChange={e => updateFormData('authors', e.target.value)}
                    placeholder="e.g. Laplante, P. or Dalkir, K."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Year</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={e => updateFormData('year', e.target.value)}
                    placeholder="e.g. 2023"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Book Title
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => updateFormData('title', e.target.value)}
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
                    value={formData.edition}
                    onChange={e => updateFormData('edition', e.target.value)}
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
                    value={formData.publisher}
                    onChange={e => updateFormData('publisher', e.target.value)}
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
                    value={formData.url}
                    onChange={e => updateFormData('url', e.target.value)}
                    placeholder="e.g. https://doi.org/10.1201/9781003306894"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {referenceType === 'journal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Author(s) (Surname, Initial(s))</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.authors}
                    onChange={e => updateFormData('authors', e.target.value)}
                    placeholder="e.g. Nonaka, I., & Takeuchi, H."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Year</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={e => updateFormData('year', e.target.value)}
                    placeholder="e.g. 2007"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Article Title
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => updateFormData('title', e.target.value)}
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
                    value={formData.journal}
                    onChange={e => updateFormData('journal', e.target.value)}
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
                    value={formData.volume}
                    onChange={e => updateFormData('volume', e.target.value)}
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
                    value={formData.issue}
                    onChange={e => updateFormData('issue', e.target.value)}
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
                    value={formData.pages}
                    onChange={e => updateFormData('pages', e.target.value)}
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
                    value={formData.url}
                    onChange={e => updateFormData('url', e.target.value)}
                    placeholder="e.g. https://doi.org/..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {referenceType === 'website' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Author(s) or Organization</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.authors}
                    onChange={e => updateFormData('authors', e.target.value)}
                    placeholder="e.g. World Health Organization or Smith, J."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <span>Year</span>
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={e => updateFormData('year', e.target.value)}
                    placeholder="e.g. 2023"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Title / Page Name
                    <RequiredMark />
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => updateFormData('title', e.target.value)}
                    placeholder="e.g. COVID-19 pandemic overview"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Website Name
                  </label>
                  <input
                    type="text"
                    value={formData.websiteName}
                    onChange={e => updateFormData('websiteName', e.target.value)}
                    placeholder="e.g. World Health Organization"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  URL
                  <RequiredMark />
                </label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={e => updateFormData('url', e.target.value)}
                  placeholder="e.g. https://www.who.int/emergencies"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={saveReference}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingIndex !== null ? 'Update Reference' : 'Add Reference'}</span>
            </button>
          </div>
        </div>

        {/* References List */}
        {references.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground">
              Saved References ({references.length})
            </h4>
            {references.map((ref, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg bg-background border flex items-start justify-between gap-3 transition-colors ${
                  editingIndex === idx
                    ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                    : 'border-border/60 hover:border-primary/40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[10px] font-bold text-muted-foreground">
                      Reference #{idx + 1}
                    </div>
                    {editingIndex === idx && (
                      <span className="text-[9px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Editing...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    {ref.citation || formatApa7Reference(ref)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => editReference(idx)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                    title="Edit reference"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReference(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove reference"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
