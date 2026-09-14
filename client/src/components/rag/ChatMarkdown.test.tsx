// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ChatMarkdown } from './ChatMarkdown';
import { cleanTitleToSlug, generateCsvFilename } from './TableActionToolbar';

describe('ChatMarkdown', () => {
  it('renders markdown tables with headers and rows', () => {
    const tableMd = [
      '',
      '| Student Name | Student ID | Status |',
      '|---|---|---|',
      '| Edrich Josh | 23109093 | Returning |',
      '| Kurby John | 23103733 | Continuing |',
      '',
    ].join('\n');

    render(<ChatMarkdown content={tableMd} />);
    expect(screen.getByText('Student Name')).toBeInTheDocument();
    expect(screen.getByText('Edrich Josh')).toBeInTheDocument();
    expect(screen.getByText('23109093')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders embedded chart code fences', () => {
    const chartMd = [
      'Here is the chart:',
      '',
      '```chart',
      '{',
      '  "type": "bar",',
      '  "title": "Enrolled Breakdown",',
      '  "data": [',
      '    { "label": "Returning", "value": 1 },',
      '    { "label": "Continuing", "value": 1 }',
      '  ]',
      '}',
      '```',
    ].join('\n');

    render(<ChatMarkdown content={chartMd} />);
    expect(screen.getByText('Here is the chart:')).toBeInTheDocument();
    expect(screen.getByText('Enrolled Breakdown')).toBeInTheDocument();
  });

  it('generates dynamic CSV filenames with current date and table name', () => {
    expect(cleanTitleToSlug('📊 Student Enrollment Report — Summary Comparison')).toBe(
      'Student-Enrollment-Report—Summary-Comparison'
    );
    expect(cleanTitleToSlug('📋 Detailed Student List')).toBe('Detailed-Student-List');

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const expectedPrefix = `${mm}-${dd}-${yyyy}`;

    const filename1 = generateCsvFilename(null, '📊 Student Enrollment Report — Summary Comparison');
    expect(filename1).toBe(`${expectedPrefix}-Student-Enrollment-Report—Summary-Comparison.csv`);

    const filename2 = generateCsvFilename(null, '📋 Detailed Student List');
    expect(filename2).toBe(`${expectedPrefix}-Detailed-Student-List.csv`);
  });
});
