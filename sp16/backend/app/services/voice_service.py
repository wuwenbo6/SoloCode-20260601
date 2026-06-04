import re
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from app.mqtt.client import mqtt_client
from app.core.config import settings
from app.crud.scene import get_scene_by_name
from app.rules.scene_executor import execute_scene


def _extract_temperature(text: str) -> Optional[float]:
    match = re.search(r'(\d+(?:\.\d+)?)\s*度', text)
    if match:
        return float(match.group(1))
    match = re.search(r'(\d+(?:\.\d+)?)\s*°?C', text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def _extract_brightness(text: str) -> Optional[int]:
    match = re.search(r'(\d+)\s*%', text)
    if match:
        return int(match.group(1))
    if '最亮' in text or '全开' in text:
        return 100
    if '最暗' in text or '半亮' in text:
        return 50
    return None


def _contains_any(text: str, keywords: List[str]) -> bool:
    return any(k in text for k in keywords)


def parse_voice_command(text: str, db: Optional[Session] = None) -> Dict:
    text = text.lower().strip()
    commands = []
    device_type = None
    action_type = None
    action_value = None

    if _contains_any(text, ['空调', '冷气', '制冷']):
        device_type = 'ac'
    elif _contains_any(text, ['灯', '灯光', '照明']):
        device_type = 'light'

    if _contains_any(text, ['打开', '开启', '开', '启动']):
        if device_type == 'ac':
            action_type = 'ac_on'
        elif device_type == 'light':
            action_type = 'light_on'
    elif _contains_any(text, ['关闭', '关掉', '关', '停止']):
        if device_type == 'ac':
            action_type = 'ac_off'
        elif device_type == 'light':
            action_type = 'light_off'
    elif _contains_any(text, ['设置', '调到', '设为', '调整', '调节']):
        if device_type == 'ac':
            temp = _extract_temperature(text)
            if temp is not None:
                action_type = 'ac_set_temp'
                action_value = temp
        elif device_type == 'light':
            brightness = _extract_brightness(text)
            if brightness is not None:
                action_type = 'light_set_brightness'
                action_value = brightness

    if _contains_any(text, ['温度', '暖和', '暖一点', '热一点']):
        temp = _extract_temperature(text)
        if temp is not None:
            device_type = 'ac'
            action_type = 'ac_set_temp'
            action_value = temp
        elif _contains_any(text, ['高', '升高', '提高']):
            device_type = 'ac'
            action_type = 'ac_set_temp'
            action_value = 26.0
        elif _contains_any(text, ['低', '降低', '调低']):
            device_type = 'ac'
            action_type = 'ac_set_temp'
            action_value = 22.0

    if _contains_any(text, ['亮度', '亮一点']):
        brightness = _extract_brightness(text)
        if brightness is not None:
            device_type = 'light'
            action_type = 'light_set_brightness'
            action_value = brightness

    scene_match = None
    if _contains_any(text, ['场景', '模式']):
        if _contains_any(text, ['离家', '出门']):
            scene_match = '离家模式'
        elif _contains_any(text, ['回家', '到家']):
            scene_match = '回家模式'
        elif _contains_any(text, ['睡觉', '睡眠', '休息']):
            scene_match = '睡眠模式'
        elif _contains_any(text, ['观影', '电影', '影院']):
            scene_match = '观影模式'
        elif _contains_any(text, ['阅读', '看书', '学习']):
            scene_match = '阅读模式'

    if scene_match and db is not None:
        scene = get_scene_by_name(db, scene_match)
        if scene:
            return {
                'success': True,
                'message': f"已解析场景指令: {scene_match}",
                'parsed_commands': [{
                    'type': 'scene',
                    'scene_id': scene.id,
                    'scene_name': scene.name,
                }],
                'scene_id': scene.id,
            }
        else:
            return {
                'success': False,
                'message': f"未找到场景: {scene_match}",
                'parsed_commands': [],
            }

    if device_type and action_type:
        command = {
            'type': 'device',
            'device_type': device_type,
            'action_type': action_type,
            'action_value': action_value,
        }
        commands.append(command)

    if not commands:
        return {
            'success': False,
            'message': "未能识别指令，请说：打开空调、关闭灯光、把空调调到24度等",
            'parsed_commands': [],
        }

    return {
        'success': True,
        'message': f"已识别指令: {_get_command_description(commands[0])}",
        'parsed_commands': commands,
    }


def _get_command_description(cmd: Dict) -> str:
    descriptions = {
        'ac_on': '开启空调',
        'ac_off': '关闭空调',
        'ac_set_temp': f"设置空调温度为 {cmd.get('action_value')}°C",
        'light_on': '开启灯光',
        'light_off': '关闭灯光',
        'light_set_brightness': f"设置灯光亮度为 {cmd.get('action_value')}%",
    }
    return descriptions.get(cmd.get('action_type', ''), '未知指令')


def execute_parsed_commands(parsed_result: Dict, db: Session) -> Dict:
    if not parsed_result.get('success'):
        return parsed_result

    commands = parsed_result.get('parsed_commands', [])
    results = []
    all_success = True

    for cmd in commands:
        try:
            if cmd.get('type') == 'scene':
                from app.crud.scene import get_scene, update_scene_last_executed
                scene = get_scene(db, cmd['scene_id'])
                if scene:
                    result = execute_scene(scene)
                    update_scene_last_executed(db, scene.id)
                    results.append({
                        'type': 'scene',
                        'scene_name': cmd.get('scene_name', scene.name),
                        **result
                    })
                    if not result.get('success'):
                        all_success = False
                else:
                    results.append({
                        'type': 'scene',
                        'scene_name': cmd.get('scene_name'),
                        'success': False,
                        'message': '场景不存在'
                    })
                    all_success = False
            elif cmd.get('type') == 'device':
                action_type = cmd['action_type']
                action_value = cmd.get('action_value')
                topic = None
                payload = {}

                if action_type == 'ac_on':
                    topic = settings.MQTT_TOPIC_AC_CONTROL
                    payload = {"is_on": True}
                elif action_type == 'ac_off':
                    topic = settings.MQTT_TOPIC_AC_CONTROL
                    payload = {"is_on": False}
                elif action_type == 'ac_set_temp':
                    topic = settings.MQTT_TOPIC_AC_CONTROL
                    payload = {"is_on": True, "target_temperature": float(action_value)}
                elif action_type == 'light_on':
                    topic = settings.MQTT_TOPIC_LIGHT_CONTROL
                    payload = {"is_on": True}
                elif action_type == 'light_off':
                    topic = settings.MQTT_TOPIC_LIGHT_CONTROL
                    payload = {"is_on": False}
                elif action_type == 'light_set_brightness':
                    topic = settings.MQTT_TOPIC_LIGHT_CONTROL
                    payload = {"is_on": True, "brightness": int(action_value)}

                if topic:
                    mqtt_client.publish(topic, payload)
                    results.append({
                        'type': 'device',
                        'device_type': cmd.get('device_type'),
                        'action_type': action_type,
                        'success': True,
                        'message': _get_command_description(cmd)
                    })
                else:
                    results.append({
                        'type': 'device',
                        'success': False,
                        'message': '未知指令类型'
                    })
                    all_success = False
        except Exception as e:
            all_success = False
            results.append({
                'success': False,
                'message': str(e)
            })

    return {
        'success': all_success,
        'message': parsed_result.get('message', '指令执行完成'),
        'parsed_commands': commands,
        'execution_results': results,
        'executed': True
    }
