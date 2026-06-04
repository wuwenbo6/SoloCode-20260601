import numpy as np
from typing import Optional, Tuple


class STA:
    def __init__(
        self,
        sta_id: int,
        position: Tuple[float, float] = None,
        num_antennas: int = 2,
        name: str = None,
        buffer_data: float = None,
    ):
        self.sta_id = sta_id
        self.name = name or f"STA-{sta_id}"
        self.position = position or (np.random.uniform(1, 50), np.random.uniform(1, 50))
        self.num_antennas = num_antennas
        self.channel_matrix: Optional[np.ndarray] = None
        self.channel_matrix_subcarriers: Optional[np.ndarray] = None
        self.distance: float = 0.0
        self.path_loss: float = 0.0
        self.snr: float = 0.0
        self.single_throughput: float = 0.0
        self.mu_throughput: float = 0.0
        self.group_id: Optional[int] = None
        self.assigned: bool = False
        self.buffer_data = buffer_data if buffer_data is not None else np.random.uniform(0, 10000)
        self.scheduled_data: float = 0.0
        self.avg_throughput: float = 0.0
        self.pf_metric: float = 0.0

    def update_position(self, x: float, y: float):
        self.position = (x, y)

    def update_channel(self, channel_matrix: np.ndarray, distance: float, path_loss: float):
        self.channel_matrix = channel_matrix
        self.distance = distance
        self.path_loss = path_loss

    def calculate_distance_from_ap(self, ap_position: Tuple[float, float] = (0, 0)) -> float:
        dx = self.position[0] - ap_position[0]
        dy = self.position[1] - ap_position[1]
        self.distance = np.sqrt(dx ** 2 + dy ** 2)
        return self.distance

    def update_channel(
        self,
        channel_matrix: np.ndarray,
        distance: float,
        path_loss: float,
        channel_matrix_subcarriers: np.ndarray = None,
    ):
        self.channel_matrix = channel_matrix
        self.channel_matrix_subcarriers = channel_matrix_subcarriers
        self.distance = distance
        self.path_loss = path_loss

    def has_data(self) -> bool:
        return self.buffer_data > 0

    def get_buffer_data(self) -> float:
        return self.buffer_data

    def set_buffer_data(self, data: float):
        self.buffer_data = max(0, data)

    def add_data(self, data: float):
        self.buffer_data += data

    def consume_data(self, data: float) -> float:
        consumed = min(data, self.buffer_data)
        self.buffer_data -= consumed
        self.scheduled_data += consumed
        return consumed

    def update_avg_throughput(self, current_throughput: float, alpha: float = 0.9):
        if self.avg_throughput == 0:
            self.avg_throughput = current_throughput
        else:
            self.avg_throughput = alpha * self.avg_throughput + (1 - alpha) * current_throughput

    def calculate_pf_metric(self, current_throughput: float) -> float:
        if self.avg_throughput > 0:
            self.pf_metric = current_throughput / self.avg_throughput
        else:
            self.pf_metric = float('inf') if current_throughput > 0 else 0.0
        return self.pf_metric

    def reset_scheduling(self):
        self.group_id = None
        self.assigned = False
        self.mu_throughput = 0.0
        self.scheduled_data = 0.0

    def to_dict(self) -> dict:
        return {
            "sta_id": self.sta_id,
            "name": self.name,
            "position": {"x": self.position[0], "y": self.position[1]},
            "distance": round(self.distance, 2),
            "num_antennas": self.num_antennas,
            "path_loss": round(self.path_loss, 2),
            "snr": round(self.snr, 2),
            "buffer_data_kb": round(self.buffer_data / 1000, 2),
            "scheduled_data_kb": round(self.scheduled_data / 1000, 2),
            "has_data": self.has_data(),
            "avg_throughput_mbps": round(self.avg_throughput / 1e6, 2),
            "pf_metric": round(self.pf_metric, 4),
            "single_throughput_mbps": round(self.single_throughput / 1e6, 2),
            "mu_throughput_mbps": round(self.mu_throughput / 1e6, 2),
            "group_id": self.group_id,
            "assigned": self.assigned,
        }

    def __repr__(self) -> str:
        return f"STA(id={self.sta_id}, pos={self.position}, dist={self.distance:.1f}m, buffer={self.buffer_data:.1f}B)"
