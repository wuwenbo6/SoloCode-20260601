from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleUpdate


def create_rule(db: Session, rule_in: RuleCreate) -> Rule:
    db_rule = Rule(
        name=rule_in.name,
        description=rule_in.description,
        enabled=rule_in.enabled,
        cooling_minutes=rule_in.cooling_minutes,
        condition_type=rule_in.condition_type,
        condition_operator=rule_in.condition_operator,
        condition_value=rule_in.condition_value,
        time_start=rule_in.time_start,
        time_end=rule_in.time_end,
        action_type=rule_in.action_type,
        action_value=rule_in.action_value,
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_rule(db: Session, rule_id: int) -> Optional[Rule]:
    return db.query(Rule).filter(Rule.id == rule_id).first()


def get_rules(db: Session, enabled_only: bool = False) -> List[Rule]:
    query = db.query(Rule)
    if enabled_only:
        query = query.filter(Rule.enabled == True)
    return query.all()


def update_rule(db: Session, rule_id: int, rule_in: RuleUpdate) -> Optional[Rule]:
    db_rule = get_rule(db, rule_id)
    if not db_rule:
        return None

    update_data = rule_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_rule, field, value)

    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_rule(db: Session, rule_id: int) -> bool:
    db_rule = get_rule(db, rule_id)
    if not db_rule:
        return False
    db.delete(db_rule)
    db.commit()
    return True


def update_rule_last_triggered(db: Session, rule_id: int, action_hash: Optional[str] = None) -> None:
    db_rule = get_rule(db, rule_id)
    if db_rule:
        db_rule.last_triggered = datetime.utcnow()
        if action_hash is not None:
            db_rule.last_action_hash = action_hash
        db.commit()
