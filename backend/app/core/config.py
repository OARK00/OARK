from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
