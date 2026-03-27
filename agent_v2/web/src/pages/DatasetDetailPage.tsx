import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Link2, Copy, Check } from 'lucide-react';
import { getDatasetDetail } from '../services/api';
import type { DatasetDetailResponse, DownloadOption } from '../types/api';

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DatasetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDatasetDetail(id).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex-1 overflow-y-auto"><div className="max-w-[960px] mx-auto px-6 py-8">
      <div className="skeleton w-24 h-4 mb-5 rounded" /><div className="skeleton w-56 h-7 mb-3 rounded" /><div className="skeleton w-72 h-4 mb-8 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><div className="lg:col-span-2 space-y-5"><div className="skeleton h-40 rounded-lg" /><div className="skeleton h-52 rounded-lg" /></div><div className="skeleton h-52 rounded-lg" /></div>
    </div></div>
  );

  if (error || !data) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--gray-400)]">
      <p className="font-medium text-[var(--gray-600)]">Dataset not found</p>
      <p className="text-[13px]">{error || id}</p>
      <Link to="/explore" className="text-[13px] text-[var(--accent)] hover:underline flex items-center gap-1 mt-2"><ArrowLeft size={13} /> Back</Link>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-6 py-8">
        <Link to="/explore" className="inline-flex items-center gap-1 text-[13px] text-[var(--gray-400)] hover:text-[var(--accent)] transition-colors mb-5">
          <ArrowLeft size={13} /> Back to Explore
        </Link>
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="badge badge-sky font-mono">{data.entity_id}</span>
            <span className="badge badge-gray">{data.source_database}</span>
            <span className="badge badge-gray">{data.entity_type}</span>
          </div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] mb-2">{data.title || data.entity_id}</h1>
          {data.description && <p className="text-[14px] text-[var(--gray-500)] leading-relaxed max-w-[640px]">{data.description.slice(0, 500)}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <section className="card p-5">
              <h2 className="text-[13px] font-semibold text-[var(--gray-700)] mb-3">Metadata</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                <Meta label="Organism" value={data.organism} />
                <Meta label="Source" value={data.source_database} />
                <Meta label="Samples" value={data.sample_count?.toLocaleString()} />
                <Meta label="Series" value={String(data.series?.length || 0)} />
                {data.pmid && <Meta label="PMID" value={data.pmid} link={`https://pubmed.ncbi.nlm.nih.gov/${data.pmid}`} />}
                {data.doi && <Meta label="DOI" value={data.doi} link={`https://doi.org/${data.doi}`} />}
              </div>
            </section>

            {data.samples.length > 0 && (
              <section className="card p-5">
                <h2 className="text-[13px] font-semibold text-[var(--gray-700)] mb-3">Samples <span className="badge badge-gray ml-1">{data.sample_count}</span></h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr className="thead-row">
                      {['Sample ID', 'Tissue', 'Disease', 'Cell Type', 'Cells'].map((h, i) => (
                        <th key={h} className={`px-3 py-2 text-[10px] font-semibold text-[var(--gray-500)] uppercase tracking-[0.04em] ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.samples.slice(0, 50).map((s, i) => (
                        <tr key={i} className={`border-b border-[var(--border-light)] ${i % 2 ? 'bg-[var(--gray-50)]' : ''}`}>
                          <td className="px-3 py-1.5 font-mono text-[var(--accent)]">{s.sample_id as string || '—'}</td>
                          <td className="px-3 py-1.5 text-[var(--gray-600)]">{s.tissue as string || '—'}</td>
                          <td className="px-3 py-1.5 text-[var(--gray-600)]">{s.disease as string || '—'}</td>
                          <td className="px-3 py-1.5 text-[var(--gray-600)]">{s.cell_type as string || '—'}</td>
                          <td className="px-3 py-1.5 text-[var(--gray-600)] text-right tabular-nums">{s.n_cells != null ? Number(s.n_cells).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.sample_count > 50 && <p className="text-[11px] text-[var(--gray-400)] mt-2">Showing 50 of {data.sample_count.toLocaleString()}</p>}
                </div>
              </section>
            )}

            {data.cross_links.length > 0 && (
              <section className="card p-5">
                <h2 className="text-[13px] font-semibold text-[var(--gray-700)] mb-3 flex items-center gap-1.5"><Link2 size={13} className="text-[var(--gray-400)]" /> Cross-Database Links</h2>
                <div className="space-y-1">
                  {data.cross_links.map((lk, i) => (
                    <Link key={i} to={`/explore/${lk.linked_id}`} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-[var(--gray-50)] transition-colors">
                      <span className="badge badge-sky font-mono">{lk.linked_id}</span>
                      <span className="badge badge-gray">{lk.linked_database}</span>
                      <span className="text-[11px] text-[var(--gray-400)] ml-auto">{lk.relationship_type}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div><section className="card p-5 sticky top-16">
            <h2 className="text-[13px] font-semibold text-[var(--gray-700)] mb-3 flex items-center gap-1.5"><Download size={13} className="text-[var(--gray-400)]" /> Downloads</h2>
            {!data.downloads.length ? <p className="text-[13px] text-[var(--gray-400)]">No options available.</p>
            : <div className="space-y-2">{data.downloads.map((dl, i) => <DlItem key={i} item={dl} />)}</div>}
          </section></div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return <div>
    <div className="section-label mb-0.5">{label}</div>
    {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">{value}<ExternalLink size={11} /></a> : <div className="text-[var(--gray-800)]">{value}</div>}
  </div>;
}

function DlItem({ item }: { item: DownloadOption }) {
  const [copied, setCopied] = useState(false);
  const B: Record<string, string> = { h5ad: 'badge-purple', rds: 'badge-green', fastq: 'badge-blue', supplementary: 'badge-amber', matrix: 'badge-orange' };
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return <div className="p-3 bg-[var(--gray-50)] rounded-lg border border-[var(--border-light)]">
    <div className="flex items-center gap-2 mb-1.5">
      <span className={`badge ${B[item.file_type] || 'badge-gray'}`}>{item.file_type.toUpperCase()}</span>
      <span className="text-[13px] text-[var(--gray-700)] flex-1 truncate">{item.label}</span>
    </div>
    {item.instructions && <p className="text-[11px] text-[var(--gray-400)] mb-2 line-clamp-1">{item.instructions.split('\n')[0]}</p>}
    <div className="flex gap-1.5">
      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary text-[11px] py-1 px-2.5 rounded"><ExternalLink size={11} /> Open</a>}
      {item.url && <button onClick={() => copy(item.url!)} className="btn btn-secondary text-[11px] py-1 px-2.5 rounded">
        {copied ? <><Check size={11} className="text-emerald-600" /> Copied</> : <><Copy size={11} /> Copy</>}
      </button>}
    </div>
  </div>;
}
