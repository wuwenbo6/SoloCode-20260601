#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://127.0.0.1:5001"

def test_config():
    print("=== 测试配置接口 ===")
    response = requests.get(f"{BASE_URL}/api/config")
    print(f"状态码: {response.status_code}")
    print(f"配置: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.status_code == 200

def test_simulate():
    print("\n=== 测试仿真接口 ===")
    payload = {
        "algorithm": "greedy_low_corr",
        "num_stas": 10,
        "max_group_size": 4,
        "correlation_threshold": 0.5,
        "seed": 42
    }
    response = requests.post(f"{BASE_URL}/api/simulate", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"MU吞吐量: {data['throughput_summary']['total_mu_throughput_mbps']:.2f} Mbps")
        print(f"SU吞吐量: {data['throughput_summary']['total_su_throughput_mbps']:.2f} Mbps")
        print(f"增益: {data['throughput_summary']['overall_gain_percent']:.2f}%")
        print(f"分组数: {data['grouping_metrics']['num_groups']}")
        print(f"组大小: {data['grouping_metrics']['group_sizes']}")
        print("\n分组详情:")
        for g in data['groups']:
            print(f"  组{g['group_id']}: {g['sta_names']}, MU: {g['mu_throughput_mbps']:.2f} Mbps, 增益: {g['gain']:.2f}%")
    else:
        print(f"错误: {response.text}")
    return response.status_code == 200

def test_algorithms():
    print("\n=== 测试算法接口 ===")
    response = requests.get(f"{BASE_URL}/api/algorithms")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        for algo in data['algorithms']:
            print(f"  {algo['name']}: {algo['description']}")
    return response.status_code == 200

def test_compare():
    print("\n=== 测试算法对比接口 ===")
    payload = {"algorithms": ["greedy", "greedy_low_corr", "random"]}
    response = requests.post(f"{BASE_URL}/api/compare", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        for algo, result in data['comparison'].items():
            print(f"  {algo}: {result['total_mu_throughput_mbps']:.2f} Mbps, 增益: {result['overall_gain_percent']:.2f}%")
    return response.status_code == 200

def test_monte_carlo():
    print("\n=== 测试蒙特卡洛接口 ===")
    payload = {"num_iterations": 10, "algorithm": "greedy_low_corr"}
    response = requests.post(f"{BASE_URL}/api/monte_carlo", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"迭代次数: {data['num_iterations']}")
        print(f"MU吞吐量均值: {data['mu_throughput']['mean']:.2f} ± {data['mu_throughput']['std']:.2f} Mbps")
        print(f"增益均值: {data['gain_percent']['mean']:.2f} ± {data['gain_percent']['std']:.2f}%")
    return response.status_code == 200

def main():
    tests = [
        test_config,
        test_algorithms,
        test_simulate,
        test_compare,
        test_monte_carlo,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
                print("✅ 通过")
            else:
                failed += 1
                print("❌ 失败")
        except Exception as e:
            failed += 1
            print(f"❌ 异常: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n=== 测试总结 ===")
    print(f"通过: {passed}/{len(tests)}")
    print(f"失败: {failed}/{len(tests)}")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
