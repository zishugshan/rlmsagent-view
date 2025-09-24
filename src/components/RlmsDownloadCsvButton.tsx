import React from 'react';
import { buildCsvFromXml } from '@/utils/rlms-csv';

type Props = { xml?: string | null; className?: string };

export default function RlmsDownloadCsvButton({ xml, className }: Props) {
  const disabled = !xml;

  const onClick = () => {
    if (!xml) return;
    const csv = buildCsvFromXml(xml);
    const ts = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rlmsreginfo_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className ?? 'px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-50'}
      title="Download all rlmsreginfo as CSV"
    >
      Download CSV
    </button>
  );
}

