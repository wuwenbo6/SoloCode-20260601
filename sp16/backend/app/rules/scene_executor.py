from app.mqtt.client import mqtt_client
from app.core.config import settings
from app.models.scene import Scene, SceneAction


def _execute_scene_action(action: SceneAction) -> dict:
    result = {"device_type": action.device_type, "action_type": action.action_type, "success": True}

    if action.action_type == "ac_on":
        mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, {"is_on": True})
        result["message"] = "空调已开启"
    elif action.action_type == "ac_off":
        mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, {"is_on": False})
        result["message"] = "空调已关闭"
    elif action.action_type == "ac_set_temp":
        if action.action_value is not None:
            mqtt_client.publish(
                settings.MQTT_TOPIC_AC_CONTROL,
                {"is_on": True, "target_temperature": float(action.action_value)}
            )
            result["message"] = f"空调温度已设置为 {action.action_value}°C"
        else:
            result["success"] = False
            result["message"] = "缺少温度值"
    elif action.action_type == "light_on":
        mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, {"is_on": True})
        result["message"] = "灯光已开启"
    elif action.action_type == "light_off":
        mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, {"is_on": False})
        result["message"] = "灯光已关闭"
    elif action.action_type == "light_set_brightness":
        if action.action_value is not None:
            mqtt_client.publish(
                settings.MQTT_TOPIC_LIGHT_CONTROL,
                {"is_on": True, "brightness": int(action.action_value)}
            )
            result["message"] = f"灯光亮度已设置为 {action.action_value}%"
        else:
            result["success"] = False
            result["message"] = "缺少亮度值"
    else:
        result["success"] = False
        result["message"] = f"未知的动作类型: {action.action_type}"

    return result


def execute_scene(scene: Scene) -> dict:
    if not scene.enabled:
        return {
            "success": False,
            "message": f"场景 '{scene.name}' 已禁用",
            "results": []
        }

    results = []
    all_success = True

    print(f"Executing scene: {scene.name}")

    for action in scene.actions:
        try:
            result = _execute_scene_action(action)
            results.append(result)
            if not result["success"]:
                all_success = False
        except Exception as e:
            results.append({
                "device_type": action.device_type,
                "action_type": action.action_type,
                "success": False,
                "message": str(e)
            })
            all_success = False

    return {
        "success": all_success,
        "message": f"场景 '{scene.name}' 执行{'成功' if all_success else '部分失败'}",
        "results": results
    }


def execute_group_control(group_device_types: list, is_on: bool, target_temperature=None, brightness=None) -> dict:
    results = []
    all_success = True

    for device_type in group_device_types:
        try:
            if device_type == "ac":
                payload = {"is_on": is_on}
                if target_temperature is not None:
                    payload["target_temperature"] = target_temperature
                mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, payload)
                results.append({
                    "device_type": "ac",
                    "success": True,
                    "message": f"空调已{'开启' if is_on else '关闭'}"
                })
            elif device_type == "light":
                payload = {"is_on": is_on}
                if brightness is not None:
                    payload["brightness"] = brightness
                mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, payload)
                results.append({
                    "device_type": "light",
                    "success": True,
                    "message": f"灯光已{'开启' if is_on else '关闭'}"
                })
        except Exception as e:
            all_success = False
            results.append({
                "device_type": device_type,
                "success": False,
                "message": str(e)
            })

    return {
        "success": all_success,
        "message": "批量控制执行完成",
        "results": results
    }
