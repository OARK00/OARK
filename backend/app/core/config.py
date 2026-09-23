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

    # Whether the web API also runs the MQTT listener in its own process.
    # True today because Render's free plan has room for one always-on
    # service; set to false once the listener runs as its own service, so a
    # deploy or a crash of the API can no longer stop taking device data.
    ingestion_in_api: bool = True

    mqtt_host: str = "localhost"
    mqtt_port: int = 8883
    mqtt_username: str = ""
    mqtt_password: str = ""

    # AI drafting of products from a one-sentence description. The provider
    # is a setting so moving from Gemini to Claude later changes no callers.
    ai_provider: Literal["gemini"] = "gemini"
    gemini_api_key: str = ""
    # Configurable because model names are retired over time; check the
    # provider's model list if drafting starts failing with a 404. The lite
    # model is the primary because it answered reliably on the free tier
    # while the newest model was often refusing with "high demand"; when one
    # is busy the other is tried, since each model has its own capacity.
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_fallback_model: str = "gemini-3.6-flash"
    ai_drafts_per_hour: int = 20

    # EMQX deployment API, used to give every device its own broker login.
    emqx_api_url: str = ""
    emqx_api_key: str = ""
    emqx_api_secret: str = ""


settings = Settings()
