import numpy as np
from typing import Tuple, Optional


class ChannelModel:
    def __init__(
        self,
        num_antennas_ap: int = 8,
        num_antennas_sta: int = 2,
        bandwidth: float = 20e6,
        carrier_freq: float = 5e9,
        noise_figure: float = 7.0,
        num_subcarriers: int = 64,
        subcarrier_downsample: int = 10,
    ):
        self.num_antennas_ap = num_antennas_ap
        self.num_antennas_sta = num_antennas_sta
        self.bandwidth = bandwidth
        self.carrier_freq = carrier_freq
        self.noise_figure = noise_figure
        self.num_subcarriers = num_subcarriers
        self.subcarrier_downsample = subcarrier_downsample
        self.kT = -174.0
        self.noise_power = self._calculate_noise_power()
        self.subcarrier_indices = np.arange(0, num_subcarriers, subcarrier_downsample)

    def _calculate_noise_power(self) -> float:
        noise_dbm = self.kT + 10 * np.log10(self.bandwidth) + self.noise_figure
        return 10 ** (noise_dbm / 10)

    def generate_path_loss(self, distance: float) -> float:
        d0 = 1.0
        path_loss_exponent = 3.5
        if distance < d0:
            distance = d0
        path_loss_db = 20 * np.log10(4 * np.pi * d0 * self.carrier_freq / 3e8) + \
            10 * path_loss_exponent * np.log10(distance / d0)
        return path_loss_db

    def generate_fading_channel(
        self, distance: float, num_streams: int = None
    ) -> np.ndarray:
        if num_streams is None:
            num_streams = self.num_antennas_sta
        path_loss_db = self.generate_path_loss(distance)
        path_loss_linear = 10 ** (-path_loss_db / 20)
        h = (np.random.randn(num_streams, self.num_antennas_ap) +
             1j * np.random.randn(num_streams, self.num_antennas_ap)) / np.sqrt(2)
        return h * path_loss_linear

    def generate_multi_subcarrier_channel(
        self, distance: float, num_streams: int = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        if num_streams is None:
            num_streams = self.num_antennas_sta
        path_loss_db = self.generate_path_loss(distance)
        path_loss_linear = 10 ** (-path_loss_db / 20)
        h_all = np.zeros((self.num_subcarriers, num_streams, self.num_antennas_ap), dtype=complex)
        for sc in range(self.num_subcarriers):
            freq_offset = (sc - self.num_subcarriers / 2) * self.bandwidth / self.num_subcarriers
            freq_variation = 1 + 0.1 * np.sin(2 * np.pi * sc / self.num_subcarriers)
            h_sc = (np.random.randn(num_streams, self.num_antennas_ap) +
                   1j * np.random.randn(num_streams, self.num_antennas_ap)) / np.sqrt(2)
            h_all[sc] = h_sc * path_loss_linear * freq_variation
        h_avg = np.mean(h_all, axis=0)
        return h_avg, h_all

    def calculate_correlation(self, h1: np.ndarray, h2: np.ndarray) -> float:
        h1_flat = h1.flatten()
        h2_flat = h2.flatten()
        len1 = len(h1_flat)
        len2 = len(h2_flat)
        if len1 != len2:
            min_len = min(len1, len2)
            h1_flat = h1_flat[:min_len]
            h2_flat = h2_flat[:min_len]
        h1_normalized = h1_flat / (np.linalg.norm(h1_flat) + 1e-10)
        h2_normalized = h2_flat / (np.linalg.norm(h2_flat) + 1e-10)
        correlation = np.abs(np.vdot(h1_normalized, h2_normalized))
        return float(correlation)

    def calculate_correlation_subcarriers(
        self,
        h1_all: np.ndarray,
        h2_all: np.ndarray,
        downsample: int = None
    ) -> float:
        if downsample is None:
            downsample = self.subcarrier_downsample
        num_sc = h1_all.shape[0]
        sc_indices = np.arange(0, num_sc, downsample)
        correlations = []
        for sc in sc_indices:
            h1_sc = h1_all[sc].flatten()
            h2_sc = h2_all[sc].flatten()
            len1 = len(h1_sc)
            len2 = len(h2_sc)
            if len1 != len2:
                min_len = min(len1, len2)
                h1_sc = h1_sc[:min_len]
                h2_sc = h2_sc[:min_len]
            h1_normalized = h1_sc / (np.linalg.norm(h1_sc) + 1e-10)
            h2_normalized = h2_sc / (np.linalg.norm(h2_sc) + 1e-10)
            corr = np.abs(np.vdot(h1_normalized, h2_normalized))
            correlations.append(corr)
        avg_correlation = float(np.mean(correlations))
        return avg_correlation

    def get_downsampled_subcarriers(self) -> np.ndarray:
        return self.subcarrier_indices

    def get_num_downsampled_subcarriers(self) -> int:
        return len(self.subcarrier_indices)

    def calculate_snr(self, h: np.ndarray, tx_power_dbm: float) -> float:
        tx_power_linear = 10 ** (tx_power_dbm / 10) / 1000
        channel_gain = np.linalg.norm(h, 'fro') ** 2
        snr_linear = tx_power_linear * channel_gain / self.noise_power
        return 10 * np.log10(snr_linear)

    def calculate_single_user_throughput(
        self, h: np.ndarray, tx_power_dbm: float, mcs: int = None
    ) -> float:
        snr_db = self.calculate_snr(h, tx_power_dbm)
        snr_linear = 10 ** (snr_db / 10)
        num_streams = h.shape[0]
        if mcs is None:
            spectral_efficiency = np.log2(1 + snr_linear)
        else:
            spectral_efficiency = self._mcs_to_spectral_efficiency(mcs, num_streams)
        throughput = self.bandwidth * spectral_efficiency * num_streams
        return throughput

    def _mcs_to_spectral_efficiency(self, mcs: int, num_streams: int) -> float:
        mcs_table = [
            0.15, 0.23, 0.38, 0.6, 0.87, 1.15, 1.45, 1.73,
            2.17, 2.53, 3.03, 3.48, 3.91, 4.38, 4.77, 5.17,
            5.55, 5.91, 6.22, 6.55, 6.88, 7.20, 7.51, 7.81,
            8.11, 8.41, 8.69, 8.98, 9.25, 9.52, 9.78, 10.04
        ]
        mcs_index = min(mcs, len(mcs_table) - 1)
        return mcs_table[mcs_index] * num_streams

    def calculate_mu_throughput(
        self,
        group_channels: list,
        tx_powers: list,
        equal_power: bool = True
    ) -> Tuple[list, float]:
        K = len(group_channels)
        if K == 1:
            h = group_channels[0]
            tp = self.calculate_single_user_throughput(h, tx_powers[0])
            return [tp], tp

        if equal_power:
            return self._calculate_mu_throughput_zf(group_channels, tx_powers[0])
        else:
            return self._calculate_mu_throughput_power_alloc(group_channels, tx_powers)

    def _calculate_mu_throughput_zf(
        self,
        group_channels: list,
        tx_power_dbm: float
    ) -> Tuple[list, float]:
        K = len(group_channels)
        total_power = 10 ** (tx_power_dbm / 10) / 1000
        power_per_user = total_power / K

        stream_sizes = [h.shape[0] for h in group_channels]
        total_streams = sum(stream_sizes)
        H = np.vstack(group_channels)

        H_H = H.conj().T
        regularization = 1e-6 * np.eye(H.shape[0])
        H_H_inv = np.linalg.inv(H @ H_H + regularization)
        W_raw = H_H @ H_H_inv

        W = np.zeros_like(W_raw)
        start_col = 0
        for k in range(K):
            num_streams = stream_sizes[k]
            cols = slice(start_col, start_col + num_streams)
            w_k = W_raw[:, cols]
            norm = np.linalg.norm(w_k, 'fro')
            if norm > 0:
                W[:, cols] = w_k / norm * np.sqrt(power_per_user)
            start_col += num_streams

        throughputs = []
        start_col = 0
        for k in range(K):
            h_k = group_channels[k]
            num_streams = stream_sizes[k]
            cols_k = slice(start_col, start_col + num_streams)
            w_k = W[:, cols_k]

            signal_power = np.linalg.norm(h_k @ w_k, 'fro') ** 2
            interference_power = 0.0
            start_col_j = 0
            for j in range(K):
                if j != k:
                    num_streams_j = stream_sizes[j]
                    cols_j = slice(start_col_j, start_col_j + num_streams_j)
                    w_j = W[:, cols_j]
                    interference_power += np.linalg.norm(h_k @ w_j, 'fro') ** 2
                start_col_j += stream_sizes[j]

            sinr_linear = signal_power / (interference_power + self.noise_power)
            spectral_efficiency = np.log2(1 + sinr_linear)
            tp = self.bandwidth * spectral_efficiency * num_streams
            throughputs.append(tp)
            start_col += num_streams

        return throughputs, sum(throughputs)

    def _calculate_mu_throughput_power_alloc(self, group_channels, tx_powers):
        K = len(group_channels)
        throughputs = []
        total_tp = 0.0
        for k in range(K):
            h_k = group_channels[k]
            power_k = 10 ** (tx_powers[k] / 10) / 1000
            signal_power = np.linalg.norm(h_k, 'fro') ** 2 * power_k
            interference_power = 0.0
            for j in range(K):
                if j != k:
                    power_j = 10 ** (tx_powers[j] / 10) / 1000
                    correlation = self.calculate_correlation(h_k, group_channels[j])
                    interference_power += np.linalg.norm(group_channels[j], 'fro') ** 2 * power_j * correlation
            sinr_linear = signal_power / (interference_power + self.noise_power)
            num_streams = h_k.shape[0]
            spectral_efficiency = np.log2(1 + sinr_linear)
            tp = self.bandwidth * spectral_efficiency * num_streams
            throughputs.append(tp)
            total_tp += tp
        return throughputs, total_tp
