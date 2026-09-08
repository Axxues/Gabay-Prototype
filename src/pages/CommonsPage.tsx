import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { RoleGuard } from '../components/common/RoleGuard';
import { Grid, Search, Download, Star } from 'lucide-react';

export const CommonsPage: React.FC = () => {
  const { db } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredTemplates = db.commonsTemplates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (selectedCategory === 'all') return matchesSearch;
    return matchesSearch && t.category === selectedCategory;
  });

  return (
    <RoleGuard
      allowedRoles={['admin', 'faculty', 'staff']}
      fallbackMessage="Access Restricted: GABAY Commons repository is reserved for faculty members and academic administrators for sharing CHED curriculum blueprints and rubrics."
    >
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Grid className="w-5 h-5 text-red-700 dark:text-red-400" />
              <span>GABAY Institutional Commons Repository</span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono">
              CHED CMO 25 s. 2015 Shared Syllabi, Rubrics & Lab Templates
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Commons by keyword, tag, or CHED CMO..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-red-600"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-red-800 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              All Templates
            </button>
            <button
              onClick={() => setSelectedCategory('Syllabus Shell')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                selectedCategory === 'Syllabus Shell'
                  ? 'bg-red-800 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Syllabus Shells
            </button>
            <button
              onClick={() => setSelectedCategory('Assessment Rubric')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                selectedCategory === 'Assessment Rubric'
                  ? 'bg-red-800 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Rubrics
            </button>
          </div>
        </div>

        {/* Commons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredTemplates.map(tmpl => (
            <div
              key={tmpl.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-red-700/50 transition-all shadow-2xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                    {tmpl.category}
                  </span>
                  <div className="flex items-center space-x-1 text-amber-500 text-xs font-mono font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{tmpl.rating}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                  {tmpl.title}
                </h3>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {tmpl.description}
                </p>

                <div className="pt-2 text-[10px] font-mono text-zinc-500 space-y-1">
                  <div>Author: {tmpl.author}</div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold">{tmpl.chedAlignment}</div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {tmpl.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.2 text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-zinc-400">
                  {tmpl.downloads} Imports
                </span>
                <button
                  onClick={() => alert(`Importing "${tmpl.title}" into your active course shell...`)}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import Template</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
};
