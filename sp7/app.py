import numpy as np
from flask import Flask, jsonify, request, render_template, send_file, Response
from flask_cors import CORS
from simulator import WLANSimulator
from simulator.diagram import generate_grouping_diagram, generate_grouping_diagram_base64

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)


def convert_numpy_types(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(item) for item in obj)
    return obj

simulator = WLANSimulator(
    num_stas=10,
    num_ap_antennas=8,
    max_group_size=4,
    tx_power_dbm=30.0,
    bandwidth=20e6,
    carrier_freq=5e9,
    correlation_threshold=0.5,
    algorithm="greedy",
    seed=42,
    num_subcarriers=64,
    subcarrier_downsample=10,
    priority_data_sta=True,
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/algorithms", methods=["GET"])
def get_algorithms():
    algorithms = simulator.get_algorithms()
    return jsonify({"algorithms": algorithms})


@app.route("/api/simulate", methods=["POST"])
def simulate():
    data = request.get_json() or {}
    algorithm = data.get("algorithm")
    max_group_size = data.get("max_group_size")
    correlation_threshold = data.get("correlation_threshold")
    num_stas = data.get("num_stas")
    seed = data.get("seed")
    priority_data_sta = data.get("priority_data_sta")
    transmission_time = data.get("transmission_time", 1e-3)
    consume_data = data.get("consume_data", True)
    if num_stas is not None or seed is not None:
        current_num = num_stas if num_stas is not None else len(simulator.ap.stas)
        current_seed = seed if seed is not None else simulator.seed
        simulator.reset(num_stas=current_num, seed=current_seed)
    result = simulator.run_simulation(
        algorithm=algorithm,
        max_group_size=max_group_size,
        correlation_threshold=correlation_threshold,
        priority_data_sta=priority_data_sta,
        transmission_time=transmission_time,
        consume_data=consume_data,
    )
    return jsonify(convert_numpy_types(result))


@app.route("/api/compare", methods=["POST"])
def compare_algorithms():
    data = request.get_json() or {}
    algorithms = data.get("algorithms")
    results = simulator.compare_algorithms(algorithms=algorithms)
    return jsonify(convert_numpy_types({"comparison": results}))


@app.route("/api/monte_carlo", methods=["POST"])
def monte_carlo():
    data = request.get_json() or {}
    num_iterations = data.get("num_iterations", 100)
    algorithm = data.get("algorithm")
    results = simulator.run_monte_carlo(
        num_iterations=num_iterations,
        algorithm=algorithm,
    )
    return jsonify(convert_numpy_types(results))


@app.route("/api/stas", methods=["GET"])
def get_stas():
    stas = [sta.to_dict() for sta in simulator.ap.stas]
    return jsonify(convert_numpy_types({"stas": stas, "count": len(stas)}))


@app.route("/api/stas", methods=["POST"])
def add_sta():
    data = request.get_json() or {}
    position = data.get("position")
    if position:
        position = (position.get("x", 0), position.get("y", 0))
    num_antennas = data.get("num_antennas", 2)
    name = data.get("name")
    sta = simulator.add_sta(
        position=position,
        num_antennas=num_antennas,
        name=name,
    )
    return jsonify(convert_numpy_types({"sta": sta.to_dict(), "message": "STA added successfully"}))


@app.route("/api/stas/<int:sta_id>", methods=["DELETE"])
def remove_sta(sta_id):
    simulator.remove_sta(sta_id)
    return jsonify({"message": f"STA {sta_id} removed successfully"})


@app.route("/api/stas/<int:sta_id>/position", methods=["PUT"])
def update_sta_position(sta_id):
    data = request.get_json() or {}
    x = data.get("x")
    y = data.get("y")
    if x is None or y is None:
        return jsonify({"error": "x and y are required"}), 400
    simulator.update_sta_position(sta_id, x, y)
    sta = simulator.ap.get_sta(sta_id)
    if sta:
        return jsonify(convert_numpy_types({"sta": sta.to_dict()}))
    return jsonify({"error": "STA not found"}), 404


@app.route("/api/stas/<int:sta_id>/buffer_data", methods=["PUT"])
def update_sta_buffer_data(sta_id):
    data = request.get_json() or {}
    buffer_data = data.get("buffer_data")
    if buffer_data is None:
        return jsonify({"error": "buffer_data is required"}), 400
    simulator.set_sta_buffer_data(sta_id, buffer_data)
    sta = simulator.ap.get_sta(sta_id)
    if sta:
        return jsonify(convert_numpy_types({"sta": sta.to_dict()}))
    return jsonify({"error": "STA not found"}), 404


@app.route("/api/stas/buffer_data", methods=["PUT"])
def update_all_sta_buffer_data():
    data = request.get_json() or {}
    min_data = data.get("min_data", 0)
    max_data = data.get("max_data", 10000)
    simulator.set_all_sta_buffer_data(min_data=min_data, max_data=max_data)
    stas = [sta.to_dict() for sta in simulator.ap.stas]
    return jsonify(convert_numpy_types({"stas": stas, "message": "All STA buffer data updated"}))


@app.route("/api/ap", methods=["GET"])
def get_ap_info():
    return jsonify(convert_numpy_types({"ap": simulator.ap.to_dict()}))


@app.route("/api/ap", methods=["PUT"])
def update_ap_config():
    data = request.get_json() or {}
    tx_power_dbm = data.get("tx_power_dbm")
    num_antennas = data.get("num_antennas")
    max_group_size = data.get("max_group_size")
    bandwidth = data.get("bandwidth_mhz")
    carrier_freq = data.get("carrier_freq_ghz")
    if tx_power_dbm is not None:
        simulator.ap.tx_power_dbm = tx_power_dbm
    if num_antennas is not None:
        simulator.ap.num_antennas = num_antennas
        simulator.ap.channel_model.num_antennas_ap = num_antennas
    if max_group_size is not None:
        simulator.ap.max_group_size = max_group_size
    if bandwidth is not None:
        simulator.ap.channel_model.bandwidth = bandwidth * 1e6
    if carrier_freq is not None:
        simulator.ap.channel_model.carrier_freq = carrier_freq * 1e9
    return jsonify(convert_numpy_types({"ap": simulator.ap.to_dict(), "message": "AP config updated"}))


@app.route("/api/export_diagram", methods=["POST"])
def export_diagram():
    data = request.get_json() or {}
    algorithm = data.get("algorithm")
    max_group_size = data.get("max_group_size")
    correlation_threshold = data.get("correlation_threshold")
    num_stas = data.get("num_stas")
    seed = data.get("seed")
    priority_data_sta = data.get("priority_data_sta")
    export_format = data.get("format", "png")
    if num_stas is not None or seed is not None:
        current_num = num_stas if num_stas is not None else len(simulator.ap.stas)
        current_seed = seed if seed is not None else simulator.seed
        simulator.reset(num_stas=current_num, seed=current_seed)
    result = simulator.run_simulation(
        algorithm=algorithm,
        max_group_size=max_group_size,
        correlation_threshold=correlation_threshold,
        priority_data_sta=priority_data_sta,
    )
    img_bytes = generate_grouping_diagram(
        groups=result["groups"],
        stas=result["stas"],
        algorithm=result.get("algorithm", algorithm or "greedy"),
        correlation_pairs=result.get("correlation_pairs"),
        format=export_format,
    )
    mime_types = {"png": "image/png", "svg": "image/svg+xml", "pdf": "application/pdf"}
    mime = mime_types.get(export_format, "image/png")
    return Response(img_bytes, mimetype=mime, headers={
        "Content-Disposition": f"attachment; filename=mu_mimo_grouping.{export_format}"
    })


@app.route("/api/diagram_base64", methods=["POST"])
def diagram_base64():
    data = request.get_json() or {}
    algorithm = data.get("algorithm")
    max_group_size = data.get("max_group_size")
    correlation_threshold = data.get("correlation_threshold")
    num_stas = data.get("num_stas")
    seed = data.get("seed")
    priority_data_sta = data.get("priority_data_sta")
    if num_stas is not None or seed is not None:
        current_num = num_stas if num_stas is not None else len(simulator.ap.stas)
        current_seed = seed if seed is not None else simulator.seed
        simulator.reset(num_stas=current_num, seed=current_seed)
    result = simulator.run_simulation(
        algorithm=algorithm,
        max_group_size=max_group_size,
        correlation_threshold=correlation_threshold,
        priority_data_sta=priority_data_sta,
    )
    b64 = generate_grouping_diagram_base64(
        groups=result["groups"],
        stas=result["stas"],
        algorithm=result.get("algorithm", algorithm or "greedy"),
        correlation_pairs=result.get("correlation_pairs"),
    )
    return jsonify({"image_base64": b64, "algorithm": result.get("algorithm", algorithm or "greedy")})


@app.route("/api/reset", methods=["POST"])
def reset_simulator():
    data = request.get_json() or {}
    num_stas = data.get("num_stas", 10)
    seed = data.get("seed")
    simulator.reset(num_stas=num_stas, seed=seed)
    return jsonify({"message": "Simulator reset successfully"})


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify(convert_numpy_types({
        "algorithm": simulator.algorithm,
        "correlation_threshold": simulator.correlation_threshold,
        "max_group_size": simulator.ap.max_group_size,
        "num_ap_antennas": simulator.ap.num_antennas,
        "tx_power_dbm": simulator.ap.tx_power_dbm,
        "bandwidth_mhz": simulator.ap.channel_model.bandwidth / 1e6,
        "carrier_freq_ghz": simulator.ap.channel_model.carrier_freq / 1e9,
        "seed": simulator.seed,
        "priority_data_sta": simulator.priority_data_sta,
        "num_subcarriers": simulator.ap.channel_model.num_subcarriers,
        "subcarrier_downsample": simulator.ap.channel_model.subcarrier_downsample,
    }))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
