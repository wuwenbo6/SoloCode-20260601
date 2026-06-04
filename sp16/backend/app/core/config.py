from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MQTT_HOST: str = "mosquitto"
    MQTT_PORT: int = 1883
    MQTT_TOPIC_SENSOR: str = "devices/sensor/temperature"
    MQTT_TOPIC_AC: str = "devices/ac/status"
    MQTT_TOPIC_LIGHT: str = "devices/light/status"
    MQTT_TOPIC_AC_CONTROL: str = "devices/ac/control"
    MQTT_TOPIC_LIGHT_CONTROL: str = "devices/light/control"
    MQTT_TOPIC_STATUS_REQUEST: str = "devices/status/request"

    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "iotuser"
    POSTGRES_PASSWORD: str = "iotpass"
    POSTGRES_DB: str = "iotdb"

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"


settings = Settings()
