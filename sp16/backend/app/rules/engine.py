import hashlib
from datetime import datetime
from typing import Optional

from app.core.database import SessionLocal
from app.crud.rule import get_rules, update_rule_last_triggered
from app.mqtt.subscriber import get_current_temperature
from app.mqtt.client import mqtt_client
from app.core.config import settings


def _compute_action_hash(action_type: str, action_value: Optional[float]) -> str:
    raw = f"{action_type}:{action_value}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def evaluate_temperature_condition(rule, current_temp: float) -> bool:
    if rule.condition_value is None:
        return False

    operators = {
        ">": lambda a, b: a > b,
        ">=": lambda a, b: a >= b,
        "<": lambda a, b: a < b,
        "<=": lambda a, b: a <= b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
    }

    op = rule.condition_operator
    if op not in operators:
        return False

    return operators[op](current_temp, rule.condition_value)


def evaluate_time_condition(rule, now: datetime) -> bool:
    if not rule.time_start or not rule.time_end:
        return False

    try:
        current_time = now.strftime("%H:%M")
        time_start = rule.time_start
        time_end = rule.time_end

        if time_start <= time_end:
            return time_start <= current_time <= time_end
        else:
            return current_time >= time_start or current_time <= time_end
    except Exception as e:
        print(f"Error evaluating time condition: {e}")
        return False


def execute_action(rule) -> None:
    print(f"Executing rule '{rule.name}': {rule.action_type}")

    if rule.action_type == "ac_on":
        mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, {"is_on": True})
    elif rule.action_type == "ac_off":
        mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, {"is_on": False})
    elif rule.action_type == "ac_set_temp":
        if rule.action_value is not None:
            mqtt_client.publish(
                settings.MQTT_TOPIC_AC_CONTROL,
                {"is_on": True, "target_temperature": float(rule.action_value)}
            )
    elif rule.action_type == "light_on":
        mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, {"is_on": True})
    elif rule.action_type == "light_off":
        mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, {"is_on": False})
    elif rule.action_type == "light_set_brightness":
        if rule.action_value is not None:
            mqtt_client.publish(
                settings.MQTT_TOPIC_LIGHT_CONTROL,
                {"is_on": True, "brightness": int(rule.action_value)}
            )


def evaluate_and_execute_rules() -> None:
    db = SessionLocal()
    try:
        rules = get_rules(db, enabled_only=True)
        current_temp = get_current_temperature()
        now = datetime.now()

        for rule in rules:
            condition_met = False

            if rule.condition_type == "temperature":
                if current_temp is not None:
                    condition_met = evaluate_temperature_condition(rule, current_temp)
            elif rule.condition_type == "time":
                condition_met = evaluate_time_condition(rule, now)

            if not condition_met:
                continue

            if rule.is_in_cooling():
                print(f"Rule '{rule.name}' skipped: in cooling period (last triggered {rule.last_triggered}, cooling {rule.cooling_minutes}min)")
                continue

            action_hash = _compute_action_hash(rule.action_type, rule.action_value)
            if rule.last_action_hash == action_hash:
                print(f"Rule '{rule.name}' skipped: same action already executed (hash={action_hash})")
                update_rule_last_triggered(db, rule.id, action_hash)
                continue

            print(f"Rule '{rule.name}' triggered: executing {rule.action_type}")
            execute_action(rule)
            update_rule_last_triggered(db, rule.id, action_hash)

    except Exception as e:
        print(f"Error evaluating rules: {e}")
    finally:
        db.close()
