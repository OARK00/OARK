from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

AppEnv = Literal["development", "test", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Which environment this running copy is. Must match the label stored in
    # the database it connects to (see app/core/environment.py). Defaults to
    # development so a forgotten setting can never pass as production.
    app_env: AppEnv = "development"

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    mqtt_host: str = "localhost"
    mqtt_port: int = 8883
    mqtt_username: str = ""
    mqtt_password: str = ""

    # EMQX deployment API, used to give every device its own broker login.
    emqx_api_url: str = ""
    emqx_api_key: str = ""
    emqx_api_secret: str = ""


settings = Settings()
