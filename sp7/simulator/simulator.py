import numpy as np
from typing import List, Dict, Optional, Tuple
from .sta import STA
from .ap import AP
from .grouping import MUMIMOGrouping


class WLANSimulator:
    def __init__(
        self,
        num_stas: int = 10,
        num_ap_antennas: int = 8,
        max_group_size: int = 4,
        tx_power_dbm: float = 30.0,
        bandwidth: float = 20e6,
        carrier_freq: float = 5e9,
        correlation_threshold: float = 0.5,
        algorithm: str = "greedy",
        seed: Optional[int] = None,
        num_subcarriers: int = 64,
        subcarrier_downsample: int = 10,
        priority_data_sta: bool = True,
    ):
        if seed is not None:
            np.random.seed(seed)
        self.seed = seed
        self.priority_data_sta = priority_data_sta
        self.ap = AP(
            num_antennas=num_ap_antennas,
            tx_power_dbm=tx_power_dbm,
            bandwidth=bandwidth,
            carrier_freq=carrier_freq,
            max_group_size=max_group_size,
            num_subcarriers=num_subcarriers,
            subcarrier_downsample=subcarrier_downsample,
        )
        self.grouping = MUMIMOGrouping(
            ap=self.ap,
            correlation_threshold=correlation_threshold,
            algorithm=algorithm,
        )
        self.algorithm = algorithm
        self.correlation_threshold = correlation_threshold
        self._initialize_stas(num_stas)

    def _initialize_stas(self, num_stas: int):
        for i in range(num_stas):
            x = np.random.uniform(1, 50)
            y = np.random.uniform(1, 50)
            num_antennas = np.random.choice([1, 2, 4], p=[0.2, 0.6, 0.2])
            buffer_data = np.random.uniform(0, 10000)
            sta = STA(
                sta_id=i,
                position=(x, y),
                num_antennas=num_antennas,
                name=f"STA-{i}",
                buffer_data=buffer_data,
            )
            self.ap.add_sta(sta)
        self.ap.update_channels()

    def add_sta(
        self,
        position: Tuple[float, float] = None,
        num_antennas: int = 2,
        name: str = None,
    ) -> STA:
        new_id = max([s.sta_id for s in self.ap.stas], default=-1) + 1
        sta = STA(
            sta_id=new_id,
            position=position,
            num_antennas=num_antennas,
            name=name or f"STA-{new_id}",
        )
        self.ap.add_sta(sta)
        self.ap.update_channels()
        return sta

    def remove_sta(self, sta_id: int):
        self.ap.remove_sta(sta_id)

    def update_sta_position(self, sta_id: int, x: float, y: float):
        sta = self.ap.get_sta(sta_id)
        if sta:
            sta.update_position(x, y)
            self.ap.update_channels()

    def run_simulation(
        self,
        algorithm: str = None,
        max_group_size: int = None,
        correlation_threshold: float = None,
        priority_data_sta: bool = None,
        transmission_time: float = 1e-3,
        consume_data: bool = True,
    ) -> Dict:
        if algorithm is not None:
            self.algorithm = algorithm
        if max_group_size is not None:
            self.ap.max_group_size = max_group_size
        if correlation_threshold is not None:
            self.correlation_threshold = correlation_threshold
        if priority_data_sta is not None:
            self.priority_data_sta = priority_data_sta
        self.ap.update_channels()
        groups = self.grouping.group_stas(
            algorithm=self.algorithm,
            max_group_size=self.ap.max_group_size,
            correlation_threshold=self.correlation_threshold,
            priority_data_sta=self.priority_data_sta,
        )
        transmission_results = self.ap.simulate_transmission(
            transmission_time=transmission_time,
            consume_data=consume_data,
        )
        grouping_metrics = self.grouping.get_grouping_metrics()
        return {
            "ap_info": self.ap.to_dict(),
            "stas": [sta.to_dict() for sta in self.ap.stas],
            "groups": transmission_results["groups"],
            "grouping_metrics": grouping_metrics,
            "throughput_summary": {
                "total_mu_throughput_mbps": transmission_results["total_mu_throughput_mbps"],
                "total_su_throughput_mbps": transmission_results["total_su_throughput_mbps"],
                "overall_gain_percent": transmission_results["overall_gain_percent"],
                "total_data_transferred_kb": transmission_results["total_data_transferred_kb"],
            },
            "correlation_pairs": self.ap.get_correlation_pairs(),
            "algorithm": self.algorithm,
            "correlation_threshold": self.correlation_threshold,
            "max_group_size": self.ap.max_group_size,
            "priority_data_sta": self.priority_data_sta,
            "num_subcarriers": self.ap.channel_model.num_subcarriers,
            "subcarrier_downsample": self.ap.channel_model.subcarrier_downsample,
        }

    def set_sta_buffer_data(self, sta_id: int, buffer_data: float):
        sta = self.ap.get_sta(sta_id)
        if sta:
            sta.set_buffer_data(buffer_data)

    def set_all_sta_buffer_data(self, min_data: float = 0, max_data: float = 10000):
        for sta in self.ap.stas:
            buffer_data = np.random.uniform(min_data, max_data)
            sta.set_buffer_data(buffer_data)

    def get_algorithms(self) -> List[Dict]:
        return MUMIMOGrouping.get_available_algorithms()

    def compare_algorithms(self, algorithms: List[str] = None) -> Dict:
        if algorithms is None:
            algorithms = [a["name"] for a in self.get_algorithms()]
        results = {}
        for algo in algorithms:
            self.algorithm = algo
            result = self.run_simulation()
            results[algo] = {
                "total_mu_throughput_mbps": result["throughput_summary"]["total_mu_throughput_mbps"],
                "total_su_throughput_mbps": result["throughput_summary"]["total_su_throughput_mbps"],
                "overall_gain_percent": result["throughput_summary"]["overall_gain_percent"],
                "num_groups": result["grouping_metrics"]["num_groups"],
                "avg_group_size": result["grouping_metrics"]["avg_group_size"],
                "avg_intra_group_correlation": result["grouping_metrics"]["avg_intra_group_correlation"],
            }
        return results

    def run_monte_carlo(
        self,
        num_iterations: int = 100,
        algorithm: str = None,
    ) -> Dict:
        if algorithm is None:
            algorithm = self.algorithm
        mu_throughputs = []
        su_throughputs = []
        gains = []
        num_groups_list = []
        original_seed = self.seed
        for i in range(num_iterations):
            self.seed = i
            np.random.seed(i)
            self.ap.update_channels()
            result = self.run_simulation(algorithm=algorithm)
            mu_throughputs.append(result["throughput_summary"]["total_mu_throughput_mbps"])
            su_throughputs.append(result["throughput_summary"]["total_su_throughput_mbps"])
            gains.append(result["throughput_summary"]["overall_gain_percent"])
            num_groups_list.append(result["grouping_metrics"]["num_groups"])
        self.seed = original_seed
        if original_seed is not None:
            np.random.seed(original_seed)
        return {
            "num_iterations": int(num_iterations),
            "algorithm": str(algorithm),
            "mu_throughput": {
                "mean": round(float(np.mean(mu_throughputs)), 2),
                "std": round(float(np.std(mu_throughputs)), 2),
                "min": round(float(np.min(mu_throughputs)), 2),
                "max": round(float(np.max(mu_throughputs)), 2),
            },
            "su_throughput": {
                "mean": round(float(np.mean(su_throughputs)), 2),
                "std": round(float(np.std(su_throughputs)), 2),
                "min": round(float(np.min(su_throughputs)), 2),
                "max": round(float(np.max(su_throughputs)), 2),
            },
            "gain_percent": {
                "mean": round(float(np.mean(gains)), 2),
                "std": round(float(np.std(gains)), 2),
                "min": round(float(np.min(gains)), 2),
                "max": round(float(np.max(gains)), 2),
            },
            "avg_num_groups": round(float(np.mean(num_groups_list)), 2),
        }

    def reset(self, num_stas: int = None, seed: int = None):
        if seed is not None:
            self.seed = seed
            np.random.seed(seed)
        self.ap.reset()
        self.ap.stas = []
        if num_stas is not None:
            self._initialize_stas(num_stas)
        self.ap.update_channels()

    def __repr__(self) -> str:
        return (
            f"WLANSimulator(STAs={len(self.ap.stas)}, "
            f"AP_Antennas={self.ap.num_antennas}, "
            f"Algorithm={self.algorithm})"
        )
