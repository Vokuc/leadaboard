'use client';

import React, { useState } from 'react';
import { Share2, Download, Check, Copy } from 'lucide-react';

interface ShareableTableProps {
  data: any[];
  columns: { key: string; label: string }[];
  filename?: string;
}

export default function ShareableTable({ data, columns, filename = 'leaderboard' }: ShareableTableProps) {
  const [copied, setCopied] = useState(false);

  const generateText = () => {
    const headers = columns.map((c) => c.label).join('\t');
    const rows = data.map((row) => columns.map((c) => row[c.key]).join('\t')).join('\n');
    return `${headers}\n${rows}`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownloadCsv = () => {
    const headers = columns.map((c) => c.label).join(',');
    const rows = data.map((row) => columns.map((c) => {
      const val = row[c.key];
      // Basic escaping for CSV
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleCopyText}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-semibold rounded-lg text-neutral-300 hover:text-white transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy Text'}
      </button>
      <button
        onClick={handleDownloadCsv}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-semibold rounded-lg text-neutral-300 hover:text-white transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Download CSV
      </button>
    </div>
  );
}
