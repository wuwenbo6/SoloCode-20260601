import numpy as np
from typing import List, Dict, Tuple, Callable
from .ap import AP
from .sta import STA


class MUMIMOGrouping:
    def __init__(
        self,
        ap: AP,
        correlation_threshold: float = 0.5,
        algorithm: str = "greedy",
    ):
        self.ap = ap
        self.correlation_threshold = correlation_threshold
        self.algorithm = algorithm
        self._algorithms = {
            "greedy": self._greedy_grouping,
            "greedy_low_corr": self._greedy_low_correlation_first,
            "kmeans": self._kmeans_grouping,
            "random": self._random_grouping,
            "sorted_snr": self._sorted_snr_grouping,
            "pf": self._pf_grouping,
        }

    def group_stas(self, **kwargs) -> List[List[STA]]:
        self.ap.reset()
        algorithm = kwargs.get("algorithm", self.algorithm)
        max_group_size = kwargs.get("max_group_size", self.ap.max_group_size)
        correlation_threshold = kwargs.get(
            "correlation_threshold", self.correlation_threshold
        )
        priority_data_sta = kwargs.get("priority_data_sta", True)
        if algorithm not in self._algorithms:
            raise ValueError(
                f"Unknown algorithm: {algorithm}. "
                f"Available: {list(self._algorithms.keys())}"
            )
        self.ap.compute_correlation_matrix()
        groups = self._algorithms[algorithm](
            max_group_size,
            correlation_threshold,
            priority_data_sta
        )
        self.ap.groups = groups
        return groups

    def _get_stas_with_data_priority(self, indices: List[int]) -> List[int]:
        return sorted(
            indices,
            key=lambda i: (-self.ap.stas[i].buffer_data, i)
        )

    def _greedy_grouping(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        groups: List[List[STA]] = []
        all_indices = list(range(len(self.ap.stas)))
        if priority_data_sta:
            unassigned = self._get_stas_with_data_priority(all_indices)
        else:
            unassigned = all_indices
        while unassigned:
            current_group = []
            first_idx = unassigned.pop(0)
            current_group.append(first_idx)
            candidates = list(unassigned)
            for idx in candidates:
                if len(current_group) >= max_group_size:
                    break
                compatible = True
                for member_idx in current_group:
                    corr = self.ap.correlation_matrix[idx, member_idx]
                    if corr >= correlation_threshold:
                        compatible = False
                        break
                if compatible:
                    current_group.append(idx)
                    unassigned.remove(idx)
            group_stas = [self.ap.stas[i] for i in current_group]
            for sta in group_stas:
                sta.group_id = len(groups)
                sta.assigned = True
            groups.append(group_stas)
        return groups

    def _greedy_low_correlation_first(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        groups: List[List[STA]] = []
        n = len(self.ap.stas)
        all_indices = list(range(n))
        if priority_data_sta:
            data_order = self._get_stas_with_data_priority(all_indices)
            data_rank = {idx: rank for rank, idx in enumerate(data_order)}
        else:
            data_rank = {idx: idx for idx in all_indices}
        avg_correlation = np.zeros(n)
        for i in range(n):
            correlations = [
                self.ap.correlation_matrix[i, j]
                for j in range(n)
                if j != i
            ]
            avg_correlation[i] = np.mean(correlations) if correlations else 0
        sorted_indices = sorted(range(n), key=lambda x: (data_rank[x], avg_correlation[x]))
        unassigned = list(sorted_indices)
        for seed_idx in sorted_indices:
            if seed_idx not in unassigned:
                continue
            current_group = [seed_idx]
            unassigned.remove(seed_idx)
            other_stations = [
                i for i in sorted_indices
                if i in unassigned and i != seed_idx
            ]
            for idx in other_stations:
                if len(current_group) >= max_group_size:
                    break
                compatible = True
                for member_idx in current_group:
                    corr = self.ap.correlation_matrix[idx, member_idx]
                    if corr >= correlation_threshold:
                        compatible = False
                        break
                if compatible:
                    current_group.append(idx)
                    unassigned.remove(idx)
            group_stas = [self.ap.stas[i] for i in current_group]
            for sta in group_stas:
                sta.group_id = len(groups)
                sta.assigned = True
            groups.append(group_stas)
        return groups

    def _kmeans_grouping(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        from scipy.cluster.vq import kmeans, vq
        n = len(self.ap.stas)
        if n == 0:
            return []
        num_groups = max(1, (n + max_group_size - 1) // max_group_size)
        features = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                features[i, j] = 1.0 - self.ap.correlation_matrix[i, j]
        features = features / np.linalg.norm(features, axis=1, keepdims=True)
        centroids, _ = kmeans(features, num_groups)
        labels, _ = vq(features, centroids)
        raw_groups: Dict[int, List[int]] = {}
        for i, label in enumerate(labels):
            if label not in raw_groups:
                raw_groups[label] = []
            raw_groups[label].append(i)
        groups: List[List[STA]] = []
        for label, indices in raw_groups.items():
            if priority_data_sta:
                indices = self._get_stas_with_data_priority(indices)
            if len(indices) > max_group_size:
                sub_groups = [
                    indices[i:i + max_group_size]
                    for i in range(0, len(indices), max_group_size)
                ]
                for sub_group in sub_groups:
                    if self._validate_group(sub_group, correlation_threshold):
                        group_stas = [self.ap.stas[i] for i in sub_group]
                        for sta in group_stas:
                            sta.group_id = len(groups)
                            sta.assigned = True
                        groups.append(group_stas)
                    else:
                        for idx in sub_group:
                            groups.append([self.ap.stas[idx]])
                            self.ap.stas[idx].group_id = len(groups) - 1
                            self.ap.stas[idx].assigned = True
            else:
                group_stas = [self.ap.stas[i] for i in indices]
                for sta in group_stas:
                    sta.group_id = len(groups)
                    sta.assigned = True
                groups.append(group_stas)
        return groups

    def _validate_group(
        self, indices: List[int], correlation_threshold: float
    ) -> bool:
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                corr = self.ap.correlation_matrix[indices[i], indices[j]]
                if corr >= correlation_threshold:
                    return False
        return True

    def _random_grouping(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        groups: List[List[STA]] = []
        indices = list(range(len(self.ap.stas)))
        if priority_data_sta:
            indices = self._get_stas_with_data_priority(indices)
        else:
            np.random.shuffle(indices)
        for i in range(0, len(indices), max_group_size):
            group_indices = indices[i:i + max_group_size]
            group_stas = [self.ap.stas[idx] for idx in group_indices]
            for sta in group_stas:
                sta.group_id = len(groups)
                sta.assigned = True
            groups.append(group_stas)
        return groups

    def _sorted_snr_grouping(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        groups: List[List[STA]] = []
        if priority_data_sta:
            sorted_stas = sorted(
                range(len(self.ap.stas)),
                key=lambda i: (-self.ap.stas[i].buffer_data, -self.ap.stas[i].snr)
            )
        else:
            sorted_stas = sorted(
                range(len(self.ap.stas)),
                key=lambda i: self.ap.stas[i].snr,
                reverse=True
            )
        unassigned = list(sorted_stas)
        while unassigned:
            current_group = [unassigned.pop(0)]
            candidates = list(unassigned)
            for idx in candidates:
                if len(current_group) >= max_group_size:
                    break
                compatible = True
                for member_idx in current_group:
                    corr = self.ap.correlation_matrix[idx, member_idx]
                    if corr >= correlation_threshold:
                        compatible = False
                        break
                if compatible:
                    current_group.append(idx)
                    unassigned.remove(idx)
            group_stas = [self.ap.stas[i] for i in current_group]
            for sta in group_stas:
                sta.group_id = len(groups)
                sta.assigned = True
            groups.append(group_stas)
        return groups

    def _pf_grouping(
        self, max_group_size: int, correlation_threshold: float, priority_data_sta: bool = True
    ) -> List[List[STA]]:
        n = len(self.ap.stas)
        for i in range(n):
            sta = self.ap.stas[i]
            sta.calculate_pf_metric(sta.single_throughput)

        if priority_data_sta:
            pf_order = sorted(
                range(n),
                key=lambda i: (
                    -self.ap.stas[i].buffer_data,
                    -self.ap.stas[i].pf_metric,
                )
            )
        else:
            pf_order = sorted(
                range(n),
                key=lambda i: -self.ap.stas[i].pf_metric
            )

        groups: List[List[STA]] = []
        unassigned = list(pf_order)
        while unassigned:
            current_group = [unassigned.pop(0)]
            candidates = list(unassigned)
            for idx in candidates:
                if len(current_group) >= max_group_size:
                    break
                compatible = True
                for member_idx in current_group:
                    corr = self.ap.correlation_matrix[idx, member_idx]
                    if corr >= correlation_threshold:
                        compatible = False
                        break
                if compatible:
                    current_group.append(idx)
                    unassigned.remove(idx)
            group_stas = [self.ap.stas[i] for i in current_group]
            for sta in group_stas:
                sta.group_id = len(groups)
                sta.assigned = True
            groups.append(group_stas)

        for group in groups:
            group_throughput = sum(sta.single_throughput for sta in group) / len(group)
            for sta in group:
                sta.update_avg_throughput(group_throughput)

        return groups

    def get_grouping_metrics(self) -> Dict:
        if not self.ap.groups:
            return {}
        group_sizes = [len(g) for g in self.ap.groups]
        avg_group_size = np.mean(group_sizes) if group_sizes else 0
        num_groups = len(self.ap.groups)
        intra_group_correlations = []
        for group in self.ap.groups:
            if len(group) > 1:
                indices = [self.ap.stas.index(s) for s in group]
                corrs = []
                for i in range(len(indices)):
                    for j in range(i + 1, len(indices)):
                        corrs.append(
                            self.ap.correlation_matrix[indices[i], indices[j]]
                        )
                intra_group_correlations.extend(corrs)
        avg_intra_corr = np.mean(intra_group_correlations) if intra_group_correlations else 0
        inter_group_correlations = []
        for gi in range(num_groups):
            for gj in range(gi + 1, num_groups):
                indices_i = [self.ap.stas.index(s) for s in self.ap.groups[gi]]
                indices_j = [self.ap.stas.index(s) for s in self.ap.groups[gj]]
                for i in indices_i:
                    for j in indices_j:
                        inter_group_correlations.append(
                            self.ap.correlation_matrix[i, j]
                        )
        avg_inter_corr = np.mean(inter_group_correlations) if inter_group_correlations else 0
        return {
            "num_groups": int(num_groups),
            "group_sizes": [int(s) for s in group_sizes],
            "avg_group_size": round(float(avg_group_size), 2),
            "avg_intra_group_correlation": round(float(avg_intra_corr), 4),
            "avg_inter_group_correlation": round(float(avg_inter_corr), 4),
        }

    @classmethod
    def get_available_algorithms(cls) -> List[Dict]:
        return [
            {
                "name": "greedy",
                "description": "贪心算法：按顺序将用户加入兼容组",
            },
            {
                "name": "greedy_low_corr",
                "description": "低相关优先贪心：优先将低相关性用户组合",
            },
            {
                "name": "kmeans",
                "description": "K-means聚类：基于信道特征聚类分组",
            },
            {
                "name": "sorted_snr",
                "description": "SNR排序：高SNR用户优先分组",
            },
            {
                "name": "pf",
                "description": "比例公平(PF)：按当前速率/历史均值排序，兼顾吞吐量与公平性",
            },
            {
                "name": "random",
                "description": "随机分组：用于性能对比基准",
            },
        ]
