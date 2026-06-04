#!/usr/bin/env python3
"""
WLAN MU-MIMO 模拟器 - 命令行测试脚本
"""

import sys
import numpy as np
from simulator import WLANSimulator


def print_separator(char="=", length=80):
    print(char * length)


def test_basic_simulation():
    print_separator()
    print("测试 1: 基础仿真运行")
    print_separator()

    sim = WLANSimulator(
        num_stas=10,
        num_ap_antennas=8,
        max_group_size=4,
        algorithm="greedy",
        seed=42,
    )

    print(f"初始化仿真器: {sim}")
    print(f"STA数量: {len(sim.ap.stas)}")
    print(f"AP天线数: {sim.ap.num_antennas}")
    print(f"算法: {sim.algorithm}")

    result = sim.run_simulation()

    print(f"\n吞吐量统计:")
    print(f"  MU-MIMO 总吞吐量: {result['throughput_summary']['total_mu_throughput_mbps']:.2f} Mbps")
    print(f"  SU-MIMO 总吞吐量: {result['throughput_summary']['total_su_throughput_mbps']:.2f} Mbps")
    print(f"  吞吐量增益: {result['throughput_summary']['overall_gain_percent']:.2f}%")

    print(f"\n分组指标:")
    print(f"  分组数量: {result['grouping_metrics']['num_groups']}")
    print(f"  平均组大小: {result['grouping_metrics']['avg_group_size']:.2f}")
    print(f"  组内平均相关性: {result['grouping_metrics']['avg_intra_group_correlation']:.4f}")
    print(f"  组间平均相关性: {result['grouping_metrics']['avg_inter_group_correlation']:.4f}")

    print(f"\n分组详情:")
    for group in result['groups']:
        gain_sign = "+" if group['gain'] >= 0 else ""
        print(f"  组 {group['group_id']} ({group['size']} 用户): "
              f"{group['sta_names']} | "
              f"MU: {group['mu_throughput_mbps']:.2f} Mbps | "
              f"SU: {group['su_throughput_mbps']:.2f} Mbps | "
              f"增益: {gain_sign}{group['gain']:.2f}%")

    print("\n✅ 基础仿真测试通过!")
    return True


def test_algorithm_comparison():
    print_separator()
    print("测试 2: 多算法对比")
    print_separator()

    sim = WLANSimulator(num_stas=12, seed=42)
    results = sim.compare_algorithms()

    print(f"{'算法':<15} {'MU吞吐量(Mbps)':<15} {'增益(%)':<12} {'分组数':<8} {'组内相关性':<12}")
    print("-" * 70)

    algo_names = {
        'greedy': '贪心',
        'greedy_low_corr': '低相关优先',
        'kmeans': 'K-means',
        'sorted_snr': 'SNR排序',
        'random': '随机'
    }

    for algo, data in results.items():
        name = algo_names.get(algo, algo)
        print(f"{name:<15} {data['total_mu_throughput_mbps']:<15.2f} "
              f"{data['overall_gain_percent']:<12.2f} {data['num_groups']:<8} "
              f"{data['avg_intra_group_correlation']:<12.4f}")

    best_algo = max(results.keys(), key=lambda k: results[k]['total_mu_throughput_mbps'])
    print(f"\n最佳算法: {algo_names.get(best_algo, best_algo)} "
          f"({results[best_algo]['total_mu_throughput_mbps']:.2f} Mbps)")

    print("\n✅ 算法对比测试通过!")
    return True


def test_monte_carlo():
    print_separator()
    print("测试 3: 蒙特卡洛模拟")
    print_separator()

    sim = WLANSimulator(num_stas=8, seed=42)
    print("运行 20 次蒙特卡洛模拟...")

    result = sim.run_monte_carlo(num_iterations=20, algorithm="greedy_low_corr")

    print(f"\n蒙特卡洛结果 ({result['num_iterations']} 次迭代):")
    print(f"  MU 吞吐量: {result['mu_throughput']['mean']:.2f} ± "
          f"{result['mu_throughput']['std']:.2f} Mbps "
          f"[{result['mu_throughput']['min']:.2f}, {result['mu_throughput']['max']:.2f}]")
    print(f"  SU 吞吐量: {result['su_throughput']['mean']:.2f} ± "
          f"{result['su_throughput']['std']:.2f} Mbps")
    print(f"  增益: {result['gain_percent']['mean']:.2f} ± "
          f"{result['gain_percent']['std']:.2f}%")
    print(f"  平均分组数: {result['avg_num_groups']:.2f}")

    print("\n✅ 蒙特卡洛测试通过!")
    return True


def test_sta_management():
    print_separator()
    print("测试 4: STA 管理")
    print_separator()

    sim = WLANSimulator(num_stas=5, seed=42)
    print(f"初始 STA 数量: {len(sim.ap.stas)}")

    new_sta = sim.add_sta(position=(25.0, 25.0), num_antennas=2, name="Test-STA")
    print(f"添加 STA: {new_sta.name} at {new_sta.position}")
    print(f"新 STA 数量: {len(sim.ap.stas)}")

    sim.update_sta_position(new_sta.sta_id, 30.0, 30.0)
    updated_sta = sim.ap.get_sta(new_sta.sta_id)
    print(f"更新 STA 位置: {updated_sta.position}")

    sim.remove_sta(new_sta.sta_id)
    print(f"删除 STA 后数量: {len(sim.ap.stas)}")

    print("\n✅ STA 管理测试通过!")
    return True


def test_different_configs():
    print_separator()
    print("测试 5: 不同配置参数")
    print_separator()

    configs = [
        {"num_stas": 5, "max_group_size": 2, "desc": "小组模式"},
        {"num_stas": 10, "max_group_size": 4, "desc": "标准模式"},
        {"num_stas": 20, "max_group_size": 8, "desc": "大组模式"},
    ]

    for config in configs:
        sim = WLANSimulator(
            num_stas=config["num_stas"],
            max_group_size=config["max_group_size"],
            correlation_threshold=0.6,
            seed=42,
        )
        result = sim.run_simulation(algorithm="greedy_low_corr")

        print(f"\n{config['desc']}: "
              f"{config['num_stas']} STAs, 最大组 {config['max_group_size']}")
        print(f"  吞吐量: {result['throughput_summary']['total_mu_throughput_mbps']:.2f} Mbps "
              f"(增益 {result['throughput_summary']['overall_gain_percent']:.2f}%)")
        print(f"  分组数: {result['grouping_metrics']['num_groups']}, "
              f"平均组大小: {result['grouping_metrics']['avg_group_size']:.2f}")

    print("\n✅ 配置参数测试通过!")
    return True


def test_correlation_threshold():
    print_separator()
    print("测试 6: 相关性阈值影响")
    print_separator()

    sim = WLANSimulator(num_stas=15, seed=42)
    thresholds = [0.3, 0.5, 0.7, 0.9]

    print(f"{'阈值':<10} {'分组数':<10} {'平均组大小':<12} {'组内相关性':<14} {'吞吐量(Mbps)':<15} {'增益(%)':<10}")
    print("-" * 75)

    for threshold in thresholds:
        result = sim.run_simulation(
            algorithm="greedy",
            correlation_threshold=threshold,
        )
        metrics = result['grouping_metrics']
        summary = result['throughput_summary']
        print(f"{threshold:<10} {metrics['num_groups']:<10} "
              f"{metrics['avg_group_size']:<12.2f} {metrics['avg_intra_group_correlation']:<14.4f} "
              f"{summary['total_mu_throughput_mbps']:<15.2f} {summary['overall_gain_percent']:<10.2f}")

    print("\n✅ 相关性阈值测试通过!")
    return True


def main():
    print("\n" + "=" * 80)
    print("WLAN MU-MIMO 模拟器 - 完整测试套件")
    print("=" * 80 + "\n")

    tests = [
        test_basic_simulation,
        test_algorithm_comparison,
        test_monte_carlo,
        test_sta_management,
        test_different_configs,
        test_correlation_threshold,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            failed += 1
            print(f"\n❌ 测试失败: {e}")
            import traceback
            traceback.print_exc()

    print_separator()
    print("测试总结")
    print_separator()
    print(f"通过: {passed}/{len(tests)}")
    print(f"失败: {failed}/{len(tests)}")

    if failed == 0:
        print("\n🎉 所有测试通过!")
        return 0
    else:
        print(f"\n⚠️  {failed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
