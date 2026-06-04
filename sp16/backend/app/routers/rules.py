from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.crud.rule import (
    create_rule,
    get_rule,
    get_rules,
    update_rule,
    delete_rule,
)
from app.schemas.rule import RuleCreate, RuleUpdate, RuleResponse
from app.rules.engine import evaluate_and_execute_rules

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.post("", response_model=RuleResponse)
def create_new_rule(rule_in: RuleCreate, db: Session = Depends(get_db)):
    return create_rule(db, rule_in)


@router.get("", response_model=List[RuleResponse])
def list_rules(enabled_only: bool = False, db: Session = Depends(get_db)):
    return get_rules(db, enabled_only=enabled_only)


@router.get("/{rule_id}", response_model=RuleResponse)
def get_single_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = get_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/{rule_id}", response_model=RuleResponse)
def update_existing_rule(rule_id: int, rule_in: RuleUpdate, db: Session = Depends(get_db)):
    rule = update_rule(db, rule_id, rule_in)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.delete("/{rule_id}")
def delete_existing_rule(rule_id: int, db: Session = Depends(get_db)):
    if not delete_rule(db, rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success", "message": "Rule deleted"}


@router.post("/evaluate")
def trigger_rule_evaluation():
    try:
        evaluate_and_execute_rules()
        return {"status": "success", "message": "Rules evaluated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
