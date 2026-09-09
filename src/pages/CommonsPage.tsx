import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { RoleGuard } from '../components/common/RoleGuard';
import {
  Grid,
  Search,
  Download,
  Star,
  CheckCircle2,
  X
} from 'lucide-react';

export const CommonsPage: React.FC = () => {
  const { db, importCommonsTemplate, activeCourseId } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Import Modal State
  const [importingTemplate, setImportingTemplate] = useState<any | null>(null);
  const [targetCourseId, setTargetCourseId] = useState<string>(activeCourseId || (db.courses[0]?.id || ''));
  const [importSuccessMessage, setImportSuccessMessage] = useState('');

  const filteredTemplates = db.commonsTemplates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (selectedCategory === 'all') return matchesSearch;
    return matchesSearch && t.category === selectedCategory;
  });

  const handleExecuteImport = () => {
    if (!importingTemplate || !targetCourseId) return;

    const res = importCommonsTemplate(importingTemplate.id, targetCourseId);
    if (res.success) {
      setImportSuccessMessage(res.message);
      setTimeout(() => {
        setImportingTemplate(null);
        setImportSuccessMessage('');
      }, 2000);
    }
  };

  return (
    <RoleGuard
      allowedRoles={['admin', 'faculty', 'staff']}
      fallbackMessage="Access Restricted: GABAY Commons repository is reserved for faculty members and academic administrators for sharing CHED curriculum blueprints and rubrics."
    >
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center space-x-2">
              <Grid className="w-5 h-5 text-pink-700 dark:text-pink-400" />
              <span>GABAY Institutional Commons Repository</span>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              CHED CMO 25 s. 2015 Shared Syllabi, Rubrics & Lab Templates
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Commons by keyword, tag, or CHED CMO..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-600/40"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
            {['all', 'Syllabus Shell', 'Rubric Matrix', 'Lab Module'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-pink-700 text-white shadow-soft'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? 'All Templates' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(tmpl => (
            <div
              key={tmpl.id}
              className="bg-card border border-border rounded-2xl p-5 shadow-subtle hover:border-pink-600/40 card-hover flex flex-col justify-between space-y-4 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-pink-500/10 text-pink-700 dark:text-pink-400 border border-pink-500/20">
                    {tmpl.category}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-amber-500 font-mono">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{tmpl.rating}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-foreground leading-snug">
                  {tmpl.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {tmpl.description}
                </p>

                <div className="pt-2 text-[10px] font-mono text-muted-foreground space-y-1">
                  <div>Author: {tmpl.author}</div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold">{tmpl.chedAlignment}</div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {tmpl.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground rounded-md border border-border"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {tmpl.downloads} Imports
                </span>
                <button
                  onClick={() => setImportingTemplate(tmpl)}
                  className="px-3.5 py-2 text-xs font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import Template</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal: Import Template into Course */}
        {importingTemplate && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
            <div
              className="fixed inset-0 overlay-backdrop animate-fade-in cursor-pointer"
              onClick={() => setImportingTemplate(null)}
            />

            <div
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4 z-10 animate-scale-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400">
                    <Download className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Import CHED Blueprint</h3>
                </div>
                <button
                  onClick={() => setImportingTemplate(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {importSuccessMessage ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 space-y-2 animate-fade-in">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <p>{importSuccessMessage}</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                    <div className="font-bold text-foreground">{importingTemplate.title}</div>
                    <div className="text-[11px] text-muted-foreground">{importingTemplate.description}</div>
                    <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                      {importingTemplate.chedAlignment}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Select Target Course Section to Import Into:
                    </label>
                    <select
                      value={targetCourseId}
                      onChange={e => setTargetCourseId(e.target.value)}
                      className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground text-xs"
                    >
                      {db.courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code}: {c.title} ({c.section})
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This will automatically create a new learning unit module and outcome guidelines in the chosen course shell.
                  </p>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setImportingTemplate(null)}
                      className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleExecuteImport}
                      className="px-4 py-2 font-bold bg-pink-700 hover:bg-pink-800 active:scale-[0.98] text-white rounded-xl shadow-card cursor-pointer flex items-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Confirm Import</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
};
