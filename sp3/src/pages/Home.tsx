import { useEffect } from 'react';
import { Network, Github, Info, AlertCircle, Download, FileText, Cpu } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { checkHealth } from '../utils/api';
import ConfigPanel from '../components/ConfigPanel';
import SidList from '../components/SidList';
import StatsPanel from '../components/StatsPanel';
import SrhVisualizer from '../components/SrhVisualizer';
import { cn } from '../lib/utils';

export default function Home() {
  const { result, error, clearError, setHealthy } = useSimulationStore();

  useEffect(() => {
    const healthCheck = async () => {
      try {
        const health = await checkHealth();
        setHealthy(health.pythonAvailable);
      } catch {
        setHealthy(false);
      }
    };
    healthCheck();
  }, [setHealthy]);

  const handleExportReport = (format: 'txt' | 'json') => {
    if (!result) return;
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (format === 'json') {
      content = JSON.stringify(result, null, 2);
      filename = `srv6-compression-report-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      content = result.report || generateSimpleReport(result);
      filename = `srv6-compression-report-${Date.now()}.txt`;
      mimeType = 'text/plain';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateSimpleReport = (r: typeof result) => {
    if (!r) return '';
    const lines = [
      'SRv6 SID Compression Report',
      '='.repeat(50),
      `Format: ${r.sidFormat || 'srv6'}`,
      `Method: ${r.compressionMethod}`,
      `Original: ${r.originalTotalLength} bytes (${r.originalSids.length} SIDs)`,
      `Compressed: ${r.compressedTotalLength} bytes (${r.compressedSids.length} SIDs)`,
      `Saved: ${r.bytesSaved} bytes (${r.compressionRatio}%)`,
      `Shared Prefix: ${r.sharedPrefix || 'N/A'}`,
    ];
    if (r.usidInfo) {
      lines.push('', 'uSID Details:',
        `  Total uSIDs: ${r.usidInfo.total_usids}`,
        `  Carriers: ${r.usidInfo.total_carriers}`,
        `  uSID Savings: ${r.usidInfo.bytes_saved} bytes (${r.usidInfo.compression_ratio}%)`);
    }
    return lines.join('\n');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-dark-600/50 bg-dark-800/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2 bg-primary-500/20 rounded-xl">
                  <Network className="w-6 h-6 text-primary-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">SRv6 模拟器</h1>
                <p className="text-xs text-gray-400">Segment Routing over IPv6</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
                <Info className="w-4 h-4" />
                <span>RFC 8754 · RFC 9403 · SRv6 Network Programming</span>
              </div>
              <a
                href="https://datatracker.ietf.org/doc/html/rfc8754"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">
            <span className="text-white">SRv6 </span>
            <span className="gradient-text">SID 压缩模拟器</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            可视化展示 Segment Routing Header (SRH) 的封装过程，
            对比前缀压缩前后的 SID 列表和报文长度差异
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-medium">模拟失败</p>
                <p className="text-sm text-red-300/80 mt-1">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <ConfigPanel />
          </div>
          <div className="lg:col-span-2">
            <StatsPanel result={result} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SidList
            title="原始 SID 列表"
            sids={result?.originalSids || []}
            totalLength={result?.originalTotalLength || 0}
          />
          <SidList
            title="压缩后 SID 列表"
            sids={result?.compressedSids || []}
            totalLength={result?.compressedTotalLength || 0}
            isCompressed
            sharedPrefix={result?.sharedPrefix}
            compressionInfo={result?.compressionInfo}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SrhVisualizer
            title="原始 SRH 结构"
            fields={result?.srhFields || []}
            totalLength={result?.srhTotalLength || 0}
          />
          <SrhVisualizer
            title="压缩后 SRH 结构"
            fields={result?.compressedSrhFields || []}
            totalLength={result?.compressedSrhTotalLength || 0}
            isCompressed
          />
        </div>

        {result && result.usidInfo && (
          <div className="mb-8 glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Cpu className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">uSID 微段压缩 (RFC 9403)</h3>
                <p className="text-sm text-gray-400">
                  {result.usidInfo.total_usids} 个 uSID → {result.usidInfo.total_carriers} 个 Carrier
                  · 节省 {result.usidInfo.bytes_saved} 字节 ({result.usidInfo.compression_ratio}%)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 text-center">
                <p className="text-2xl font-bold font-mono text-accent">{result.usidInfo.total_usids}</p>
                <p className="text-xs text-gray-400">uSID 总数</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 text-center">
                <p className="text-2xl font-bold font-mono text-primary-400">{result.usidInfo.total_carriers}</p>
                <p className="text-xs text-gray-400">Carrier 数</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 text-center">
                <p className="text-2xl font-bold font-mono text-accent">{result.usidInfo.num_blocks}</p>
                <p className="text-xs text-gray-400">Block 数</p>
              </div>
              <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 text-center">
                <p className="text-2xl font-bold font-mono text-accent">{result.usidInfo.compression_ratio}%</p>
                <p className="text-xs text-gray-400">uSID 压缩率</p>
              </div>
            </div>
            {result.usidCarriers && result.usidCarriers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300">uSID Carrier 列表：</p>
                {result.usidCarriers.map((carrier, idx) => (
                  <div key={idx} className="p-3 bg-dark-700/30 rounded-lg border border-dark-600/50">
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-sm font-mono text-accent">{carrier.address}</code>
                      <span className="text-xs text-primary-400">{carrier.function}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {carrier.carrier_info?.packed_functions.map((fn, fi) => (
                        <span key={fi} className="text-xs px-2 py-1 bg-primary-500/20 text-primary-300 rounded-md">
                          [{fn.index}] {fn.function} (0x{fn.usid_value.toString(16)})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-8 glass-card p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">压缩详情</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportReport('txt')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-dark-700/50 rounded-lg border border-dark-600 hover:border-primary-500/50 hover:text-primary-300 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  导出 TXT
                </button>
                <button
                  onClick={() => handleExportReport('json')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-dark-700/50 rounded-lg border border-dark-600 hover:border-accent/50 hover:text-accent transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  导出 JSON
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DetailItem 
                label="压缩方法" 
                value={result.compressionMethod}
              />
              <DetailItem 
                label="共享前缀长度" 
                value={`${result.compressionInfo.prefix_hextets || 0} 个 hextet`}
              />
              <DetailItem 
                label="已压缩 SID" 
                value={`${result.compressionInfo.sids_compressed || 0} / ${result.originalSids.length}`}
              />
              <DetailItem 
                label="分支节点" 
                value={`${result.compressionInfo.sids_at_branch || 0} 个`}
              />
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-sm text-gray-500 animate-fade-in">
          <p>
            SRv6 (Segment Routing over IPv6) 是一种基于 IPv6 的源路由技术，
            通过在 IPv6 扩展头中封装 Segment Routing Header (SRH) 来实现灵活的路径控制。
          </p>
          <p className="mt-2">
            每个 SID (Segment Identifier) 是一个 128 位的 IPv6 地址，
            前缀压缩通过提取共享前缀来减少 SRH 的长度。
            uSID (RFC 9403) 将每个微段压缩为 32 位，最多 4 个 uSID 可打包进一个 128 位 Carrier。
          </p>
        </div>
      </main>

      <footer className="border-t border-dark-600/50 bg-dark-800/30 mt-16">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              SRv6 Simulator · 用于教育和研究目的
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Python 引擎</span>
              <span className="text-gray-700">·</span>
              <span>React 前端</span>
              <span className="text-gray-700">·</span>
              <span>Express API</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-dark-700/30 rounded-xl border border-dark-600/50">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn(
        "font-semibold",
        value.includes('/') ? "text-accent" : "text-white"
      )}>
        {value}
      </p>
    </div>
  );
}
