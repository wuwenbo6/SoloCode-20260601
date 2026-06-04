import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { useEffect } from 'react';
import { fetchTemplates, fetchFlows } from '@/lib/api';
import { TemplateTable } from '@/components/TemplateTable';
import { FlowRecordTable } from '@/components/FlowRecordTable';
import { ArrowLeft } from 'lucide-react';

export default function ObserverDetail() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const navigate = useNavigate();
  const setSelectedObserver = useStore((s) => s.setSelectedObserver);
  const setTemplates = useStore((s) => s.setTemplates);
  const setFlows = useStore((s) => s.setFlows);
  const observer = useStore((s) => s.observers.find((o) => o.sourceId === Number(sourceId)));
  const selectedTemplate = useStore((s) => s.selectedTemplate);

  const sid = Number(sourceId);

  useEffect(() => {
    setSelectedObserver(sid);
    fetchTemplates(sid)
      .then(setTemplates)
      .catch(() => {});
    fetchFlows(sid, undefined, 1, 20)
      .then((res) => setFlows(res.flows, res.total, res.page, res.pageSize))
      .catch(() => {});

    return () => {
      setSelectedObserver(null);
    };
  }, [sid, setSelectedObserver, setTemplates, setFlows]);

  useEffect(() => {
    if (selectedTemplate !== null) {
      fetchFlows(sid, selectedTemplate, 1, 20)
        .then((res) => setFlows(res.flows, res.total, res.page, res.pageSize))
        .catch(() => {});
    }
  }, [selectedTemplate, sid, setFlows]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            观测点 <span className="font-mono text-cyan-400">{sourceId}</span>
          </h1>
          {observer && (
            <p className="text-slate-400 text-sm">
              {observer.address} · 模板 {observer.templateCount} · 流记录 {observer.flowCount}
            </p>
          )}
        </div>
      </div>

      <TemplateTable />
      <FlowRecordTable />
    </div>
  );
}
