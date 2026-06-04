from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.scene import VoiceCommandRequest, VoiceCommandResponse
from app.services.voice_service import parse_voice_command, execute_parsed_commands

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/parse", response_model=VoiceCommandResponse)
def parse_voice_command_endpoint(request: VoiceCommandRequest, db: Session = Depends(get_db)):
    result = parse_voice_command(request.text, db)
    return VoiceCommandResponse(**result)


@router.post("/execute")
def execute_voice_command(request: VoiceCommandRequest, db: Session = Depends(get_db)):
    parsed = parse_voice_command(request.text, db)
    if not parsed.get("success"):
        return parsed

    result = execute_parsed_commands(parsed, db)
    return result
