import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from typing import List, Dict, Optional
from io import BytesIO
import base64


def _setup_chinese_font():
    from matplotlib.font_manager import fontManager, FontProperties
    chinese_font = None
    priority_names = ['pingfang', 'hiragino sans', 'heiti', 'songti', 'stheiti']
    for pname in priority_names:
        for f in fontManager.ttflist:
            if pname in f.name.lower():
                chinese_font = f
                break
        if chinese_font:
            break
    if chinese_font:
        plt.rcParams['font.family'] = chinese_font.name
        plt.rcParams['font.sans-serif'] = [chinese_font.name]
    plt.rcParams['axes.unicode_minus'] = False


_setup_chinese_font()


GROUP_COLORS = [
    '#667eea', '#f5576c', '#38ef7d', '#ffa751',
    '#4facfe', '#a8edea', '#ff6b6b', '#48dbfb',
]


def generate_grouping_diagram(
    groups: List[Dict],
    stas: List[Dict],
    algorithm: str = "greedy",
    correlation_pairs: List[Dict] = None,
    format: str = "png",
    dpi: int = 150,
) -> bytes:
    fig, axes = plt.subplots(1, 2, figsize=(18, 9), gridspec_kw={'width_ratios': [3, 2]})

    ax_layout = axes[0]
    ax_layout.set_xlim(-1, 11)
    ax_layout.set_ylim(-1, 10)
    ax_layout.set_aspect('equal')
    ax_layout.axis('off')
    ax_layout.set_title(f'MU-MIMO 分组示意图 (算法: {algorithm})', fontsize=16, fontweight='bold', pad=15)

    ap_x, ap_y = 5, 9
    ap_circle = plt.Circle((ap_x, ap_y), 0.6, color='#333', zorder=10)
    ax_layout.add_patch(ap_circle)
    ax_layout.text(ap_x, ap_y, 'AP', ha='center', va='center', fontsize=12,
                   fontweight='bold', color='white', zorder=11)

    num_groups = len(groups)
    if num_groups == 0:
        plt.close(fig)
        buf = BytesIO()
        fig.savefig(buf, format=format, dpi=dpi, bbox_inches='tight')
        buf.seek(0)
        return buf.getvalue()

    sta_positions = {}
    for gi, group in enumerate(groups):
        color = GROUP_COLORS[gi % len(GROUP_COLORS)]
        group_sta_ids = group.get('sta_ids', [])
        group_y_base = 7.5 - gi * 2.2

        group_rect = FancyBboxPatch(
            (0.5, group_y_base - 0.8), 9, 1.6,
            boxstyle="round,pad=0.15",
            facecolor=color + '15', edgecolor=color, linewidth=2, linestyle='--'
        )
        ax_layout.add_patch(group_rect)

        ax_layout.text(0.8, group_y_base + 0.5, f'组 {gi} ({len(group_sta_ids)} 用户)',
                       fontsize=11, fontweight='bold', color=color)

        mu_tp = group.get('mu_throughput_mbps', 0)
        ax_layout.text(8.5, group_y_base + 0.5, f'{mu_tp:.1f} Mbps',
                       fontsize=10, fontweight='bold', color=color, ha='right')

        n_stas = len(group_sta_ids)
        for si, sta_id in enumerate(group_sta_ids):
            sta_info = next((s for s in stas if s['sta_id'] == sta_id), None)
            if sta_info is None:
                continue
            sta_x = 1.5 + si * 2.2
            sta_y = group_y_base - 0.2

            sta_positions[sta_id] = (sta_x, sta_y)

            sta_circle = plt.Circle((sta_x, sta_y), 0.45, color=color, alpha=0.85, zorder=5)
            ax_layout.add_patch(sta_circle)
            ax_layout.text(sta_x, sta_y + 0.05, sta_info['name'].replace('STA-', ''),
                           ha='center', va='center', fontsize=8, fontweight='bold',
                           color='white', zorder=6)

            buffer_kb = sta_info.get('buffer_data_kb', 0)
            buffer_indicator = '●' if buffer_kb > 0 else '○'
            ax_layout.text(sta_x, sta_y - 0.35, f'{buffer_kb:.0f}KB',
                           ha='center', va='top', fontsize=7, color='#555')

            ax_layout.annotate('', xy=(ap_x, ap_y - 0.6), xytext=(sta_x, sta_y + 0.45),
                               arrowprops=dict(arrowstyle='->', color=color, lw=1.2, alpha=0.5))

    ax_corr = axes[1]
    n_stas_total = len(stas)
    if n_stas_total > 0 and correlation_pairs:
        corr_matrix = np.ones((n_stas_total, n_stas_total))
        for pair in correlation_pairs:
            i, j = pair['sta1_id'], pair['sta2_id']
            corr_matrix[i, j] = pair['correlation']
            corr_matrix[j, i] = pair['correlation']

        im = ax_corr.imshow(corr_matrix, cmap='RdYlGn_r', vmin=0, vmax=1, aspect='equal')
        ax_corr.set_title('信道相关性矩阵', fontsize=13, fontweight='bold', pad=10)
        ax_corr.set_xticks(range(n_stas_total))
        ax_corr.set_yticks(range(n_stas_total))
        sta_labels = [s['name'].replace('STA-', 'S') for s in stas]
        ax_corr.set_xticklabels(sta_labels, fontsize=8)
        ax_corr.set_yticklabels(sta_labels, fontsize=8)

        for i in range(n_stas_total):
            for j in range(n_stas_total):
                text_color = 'white' if corr_matrix[i, j] > 0.5 else 'black'
                ax_corr.text(j, i, f'{corr_matrix[i, j]:.2f}',
                             ha='center', va='center', fontsize=7, color=text_color)

        for gi, group in enumerate(groups):
            color = GROUP_COLORS[gi % len(GROUP_COLORS)]
            for sta_id in group.get('sta_ids', []):
                rect = plt.Rectangle((sta_id - 0.5, sta_id - 0.5), 1, 1,
                                     fill=False, edgecolor=color, linewidth=2.5)
                ax_corr.add_patch(rect)

        plt.colorbar(im, ax=ax_corr, shrink=0.8, label='相关性')
    else:
        ax_corr.text(0.5, 0.5, '无相关性数据', ha='center', va='center',
                     fontsize=14, transform=ax_corr.transAxes)
        ax_corr.axis('off')

    plt.tight_layout()

    buf = BytesIO()
    fig.savefig(buf, format=format, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def generate_grouping_diagram_base64(**kwargs) -> str:
    img_bytes = generate_grouping_diagram(**kwargs)
    return base64.b64encode(img_bytes).decode('utf-8')
