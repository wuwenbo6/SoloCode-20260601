import numpy as np
from typing import List, Tuple, Optional, Dict
from .sta import STA
from .channel_model import ChannelModel


class AP:
    def __init__(
        self,
        num_antennas: int = 8,
        position: Tuple[float, float] = (0, 0),
        tx_power_dbm: float = 30.0,
        bandwidth: float = 20e6,
        carrier_freq: float = 5e9,
        max_group_size: int = 4,
        num_subcarriers: int = 64,
        subcarrier_downsample: int = 10,
    ):
        self.num_antennas = num_antennas
        self.position = position
        self.tx_power_dbm = tx_power_dbm
        self.max_group_size = max_group_size
        self.stas: List[STA] = []
        self.groups: List[List[STA]] = []
        self.channel_model = ChannelModel(
            num_antennas_ap=num_antennas,
            num_antennas_sta=2,
            bandwidth=bandwidth,
            carrier_freq=carrier_freq,
            num_subcarriers=num_subcarriers,
            subcarrier_downsample=subcarrier_downsample,
        )
        self.total_mu_throughput: float = 0.0
        self.total_su_throughput: float = 0.0
        self.group_throughputs: List[float] = []
        self.correlation_matrix: Optional[np.ndarray] = None

    def add_sta(self, sta: STA):
        if sta.sta_id in [s.sta_id for s in self.stas]:
            raise ValueError(f"STA with id {sta.sta_id} already exists")
        self.stas.append(sta)

    def remove_sta(self, sta_id: int):
        self.stas = [s for s in self.stas if s.sta_id != sta_id]

    def get_sta(self, sta_id: int) -> Optional[STA]:
        for sta in self.stas:
            if sta.sta_id == sta_id:
                return sta
        return None

    def update_channels(self):
        for sta in self.stas:
            distance = sta.calculate_distance_from_ap(self.position)
            path_loss = self.channel_model.generate_path_loss(distance)
            channel, channel_subcarriers = self.channel_model.generate_multi_subcarrier_channel(
                distance, num_streams=sta.num_antennas
            )
            sta.update_channel(channel, distance, path_loss, channel_subcarriers)
            sta.snr = self.channel_model.calculate_snr(channel, self.tx_power_dbm)
            sta.single_throughput = self.channel_model.calculate_single_user_throughput(
                channel, self.tx_power_dbm
            )

    def compute_correlation_matrix(self, use_subcarrier_downsample: bool = True) -> np.ndarray:
        n = len(self.stas)
        corr_matrix = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                if i == j:
                    corr_matrix[i, j] = 1.0
                elif i < j:
                    if use_subcarrier_downsample and self.stas[i].channel_matrix_subcarriers is not None:
                        corr = self.channel_model.calculate_correlation_subcarriers(
                            self.stas[i].channel_matrix_subcarriers,
                            self.stas[j].channel_matrix_subcarriers
                        )
                    else:
                        corr = self.channel_model.calculate_correlation(
                            self.stas[i].channel_matrix,
                            self.stas[j].channel_matrix
                        )
                    corr_matrix[i, j] = corr
                    corr_matrix[j, i] = corr
        self.correlation_matrix = corr_matrix
        return corr_matrix

    def get_correlation_pairs(self) -> List[Dict]:
        pairs = []
        if self.correlation_matrix is None:
            self.compute_correlation_matrix()
        for i in range(len(self.stas)):
            for j in range(i + 1, len(self.stas)):
                pairs.append({
                    "sta1_id": self.stas[i].sta_id,
                    "sta1_name": self.stas[i].name,
                    "sta2_id": self.stas[j].sta_id,
                    "sta2_name": self.stas[j].name,
                    "correlation": round(float(self.correlation_matrix[i, j]), 4)
                })
        return pairs

    def simulate_transmission(self, transmission_time: float = 1e-3, consume_data: bool = True) -> Dict:
        num_groups = len(self.groups)
        num_stas = len(self.stas)

        if num_groups == 0:
            return {
                "groups": [],
                "total_mu_throughput_mbps": 0,
                "total_su_throughput_mbps": 0,
                "overall_gain_percent": 0,
                "total_data_transferred_kb": 0,
            }

        sum_mu_group_tp = 0.0
        sum_su_all_tp = 0.0
        total_data_transferred = 0.0
        group_results = []

        for group_id, group in enumerate(self.groups):
            if len(group) == 0:
                continue
            channels = [sta.channel_matrix for sta in group]
            tx_powers = [self.tx_power_dbm for _ in group]
            throughputs, group_mu_tp = self.channel_model.calculate_mu_throughput(
                channels, tx_powers, equal_power=True
            )
            for sta, tp in zip(group, throughputs):
                sta.mu_throughput = tp
                if consume_data:
                    data_transferred = tp * transmission_time
                    consumed = sta.consume_data(data_transferred)
                    total_data_transferred += consumed
            group_su_tp_sum = sum(sta.single_throughput for sta in group)
            sum_mu_group_tp += group_mu_tp
            sum_su_all_tp += group_su_tp_sum
            self.group_throughputs.append(group_mu_tp)

            group_avg_su_tp = group_su_tp_sum / len(group) if len(group) > 0 else 0
            gain = round((group_mu_tp / group_avg_su_tp - 1) * 100, 2) if group_avg_su_tp > 0 else 0
            group_data_kb = sum(sta.scheduled_data for sta in group) / 1000

            group_results.append({
                "group_id": group_id,
                "size": len(group),
                "sta_ids": [sta.sta_id for sta in group],
                "sta_names": [sta.name for sta in group],
                "sta_buffer_data_kb": [round(sta.buffer_data / 1000, 2) for sta in group],
                "sta_scheduled_data_kb": [round(sta.scheduled_data / 1000, 2) for sta in group],
                "mu_throughput_mbps": round(group_mu_tp / 1e6, 2),
                "su_throughput_mbps": round(group_avg_su_tp / 1e6, 2),
                "data_transferred_kb": round(group_data_kb, 2),
                "gain": gain,
            })

        su_throughput_per_timeslot = sum_su_all_tp / num_stas if num_stas > 0 else 0
        mu_throughput_per_timeslot = sum_mu_group_tp / num_groups if num_groups > 0 else 0

        self.total_mu_throughput = mu_throughput_per_timeslot
        self.total_su_throughput = su_throughput_per_timeslot

        overall_gain = round((mu_throughput_per_timeslot / su_throughput_per_timeslot - 1) * 100, 2) if su_throughput_per_timeslot > 0 else 0

        return {
            "groups": group_results,
            "total_mu_throughput_mbps": round(mu_throughput_per_timeslot / 1e6, 2),
            "total_su_throughput_mbps": round(su_throughput_per_timeslot / 1e6, 2),
            "overall_gain_percent": overall_gain,
            "total_data_transferred_kb": round(total_data_transferred / 1000, 2),
        }

    def reset(self):
        self.groups = []
        self.group_throughputs = []
        self.total_mu_throughput = 0.0
        self.total_su_throughput = 0.0
        for sta in self.stas:
            sta.reset_scheduling()

    def to_dict(self) -> dict:
        return {
            "num_antennas": self.num_antennas,
            "position": {"x": self.position[0], "y": self.position[1]},
            "tx_power_dbm": self.tx_power_dbm,
            "max_group_size": self.max_group_size,
            "bandwidth_mhz": self.channel_model.bandwidth / 1e6,
            "carrier_freq_ghz": self.channel_model.carrier_freq / 1e9,
            "num_stas": len(self.stas),
            "total_mu_throughput_mbps": round(self.total_mu_throughput / 1e6, 2),
            "total_su_throughput_mbps": round(self.total_su_throughput / 1e6, 2),
        }
