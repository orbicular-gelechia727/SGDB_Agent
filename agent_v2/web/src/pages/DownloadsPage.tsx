import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Download, Plus, X, Loader2, ArrowRight, Database } from 'lucide-react';
import { getDownloads, generateManifest, downloadBlob, downloadMetadata } from '../services/api';
import type { DownloadOption } from '../types/api';

const TYPES = ['fastq', 'h5ad', 'rds', 'supplementary', 'matrix'];
const FMTS = [{ v: 'tsv', l: 'TSV' }, { v: 'bash', l: 'Bash' }, { v: 'aria2', l: 'aria2c' }];

export default function DownloadsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ids, setIds] = useState<string[]>([]);
  const [inp, setInp] = useState('');
  const [res, setRes] = useState<Record<string, DownloadOption[]>>({});
  const [loading, setLoading] = useState(false);
  const [fmt, setFmt] = useState('tsv');
  const [types, setTypes] = useState(['fastq', 'h5ad', 'supplementary']);

  // Parse ?ids= URL param on mount
  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const parsed = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (parsed.length) setIds(parsed);
    }
  }, [searchParams]);

  const add = () => { const t = inp.trim(); if (t && !ids.includes(t)) { setIds([...ids, t]); setInp(''); } };
  const rm = (id: string) => { setIds(ids.filter((i) => i !== id)); const n = { ...res }; delete n[id]; setRes(n); };

  const lookup = async () => {
    setLoading(true);
    const r: Record<string, DownloadOption[]> = {};
    for (const id of ids) { try { r[id] = (await getDownloads(id)).downloads as DownloadOption[]; } catch { r[id] = []; } }
    setRes(r); setLoading(false);
  };

  const manifest = async () => {
    try { const b = await generateManifest(ids, types, fmt); downloadBlob(b, `sceqtl_downloads.${fmt === 'bash' ? 'sh' : fmt === 'aria2' ? 'aria2' : 'tsv'}`); }
    catch (e) { console.error(e); }
  };

  const tog = (t: string) => setTypes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const B: Record<string, string> = { h5ad: 'badge-purple', fastq: 'badge-blue', rds: 'badge-green' };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] mb-1">Download Center</h1>
        <div className="flex items-center justify-between mb-6">
          <p className="text-[14px] text-[var(--gray-500)]">Look up downloads by dataset ID or generate bulk scripts.</p>
          <button onClick={() => navigate('/explore')}
            className="btn-ghost text-[12px] inline-flex items-center gap-1 px-2 py-1 shrink-0">
            <Database size={13} /> Explore Datasets
          </button>
        </div>

        <div className="card p-5 mb-5">
          <div className="section-label mb-2">Dataset IDs</div>
          <div className="flex gap-2 mb-3">
            <input type="text" value={inp} onChange={(e) => setInp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder="GSE149614, PRJNA625551..." className="input text-[13px] py-2" />
            <button onClick={add} className="btn btn-secondary px-3"><Plus size={15} /></button>
          </div>
          {ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ids.map((id) => <span key={id} className="badge badge-sky font-mono inline-flex items-center gap-1">{id}<button onClick={() => rm(id)} className="opacity-40 hover:opacity-100"><X size={11} /></button></span>)}
            </div>
          )}
          <button onClick={lookup} disabled={!ids.length || loading} className="btn btn-primary text-[13px] disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Look Up
          </button>
        </div>

        {Object.keys(res).length > 0 && (
          <div className="space-y-3 mb-5">
            {Object.entries(res).map(([id, dls]) => (
              <div key={id} className="card p-5">
                <div className="mb-3"><span className="badge badge-sky font-mono">{id}</span></div>
                {!dls.length ? <p className="text-[13px] text-[var(--gray-400)]">No options found.</p>
                : <div className="space-y-1.5">{dls.map((dl, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 bg-[var(--gray-50)] rounded-md border border-[var(--border-light)]">
                    <span className={`badge ${B[dl.file_type] || 'badge-gray'}`}>{dl.file_type.toUpperCase()}</span>
                    <span className="flex-1 text-[13px] text-[var(--gray-600)] truncate">{dl.label}</span>
                    {dl.url && <a href={dl.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-0.5">Open<ArrowRight size={11} /></a>}
                  </div>
                ))}</div>}
              </div>
            ))}
          </div>
        )}

        {ids.length > 0 && (
          <div className="card p-5 mb-5">
            <div className="section-label mb-3">Bulk Download Script</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[12px] text-[var(--gray-500)] mb-2 font-medium">File Types</div>
                <div className="flex flex-wrap gap-1.5">{TYPES.map((t) => (
                  <button key={t} onClick={() => tog(t)} className={`px-2.5 py-1 text-[12px] rounded-md border font-medium transition-colors ${types.includes(t) ? 'bg-[var(--accent-bg)] border-[var(--accent-border)] text-[var(--accent)]' : 'bg-white border-[var(--border)] text-[var(--gray-400)]'}`}>{t.toUpperCase()}</button>
                ))}</div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--gray-500)] mb-2 font-medium">Format</div>
                <div className="flex gap-1.5">{FMTS.map((f) => (
                  <button key={f.v} onClick={() => setFmt(f.v)} className={`px-3 py-1 text-[12px] rounded-md border font-medium transition-colors ${fmt === f.v ? 'bg-[var(--accent-bg)] border-[var(--accent-border)] text-[var(--accent)]' : 'bg-white border-[var(--border)] text-[var(--gray-400)]'}`}>{f.l}</button>
                ))}</div>
              </div>
            </div>
            <button onClick={manifest} className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-[13px]"><Download size={14} /> Generate</button>
          </div>
        )}

        <div className="card p-5 mb-5">
          <div className="section-label mb-3">Metadata Download</div>
          <p className="text-[13px] text-[var(--gray-500)] mb-3">
            Export unified sample metadata (tissue, disease, organism, assay, etc.) as CSV or JSON.
          </p>
          <div className="flex gap-2">
            <button onClick={async () => {
              try { const b = await downloadMetadata([], 'csv', 1000); downloadBlob(b, 'sceqtl_metadata.csv'); } catch (e) { console.error(e); }
            }} className="btn btn-secondary text-[13px] inline-flex items-center gap-1">
              <Download size={13} /> CSV (1K samples)
            </button>
            <button onClick={async () => {
              try { const b = await downloadMetadata([], 'json', 1000); downloadBlob(b, 'sceqtl_metadata.json'); } catch (e) { console.error(e); }
            }} className="btn btn-secondary text-[13px] inline-flex items-center gap-1">
              <Download size={13} /> JSON (1K samples)
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="section-label mb-4">Tools Guide</div>
          <div className="space-y-4">
            <div><h3 className="text-[13px] font-medium text-[var(--gray-700)] mb-1.5">SRA Toolkit</h3><pre className="code-block">{`# conda install -c bioconda sra-tools\nprefetch SRR1234567\nfastq-dump --split-files --gzip SRR1234567`}</pre></div>
            <div><h3 className="text-[13px] font-medium text-[var(--gray-700)] mb-1.5">wget</h3><pre className="code-block">{`wget -r -np -nH --cut-dirs=6 \\\n  https://ftp.ncbi.nlm.nih.gov/geo/series/GSEnnn/GSExxxxx/suppl/`}</pre></div>
            <div><h3 className="text-[13px] font-medium text-[var(--gray-700)] mb-1.5">Python</h3><pre className="code-block">{`import scanpy as sc\nadata = sc.read_h5ad("downloaded_file.h5ad")\nprint(adata)`}</pre></div>
          </div>
        </div>
      </div>
    </div>
  );
}
