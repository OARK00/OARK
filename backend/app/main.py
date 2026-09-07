from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.auth.router import router as auth_router
from app.modules.devices.router import router as devices_router

app = FastAPI(title="Oark IoT Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://oark-frontend.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(devices_router)


@app.get("/health")
def health():
    return {"status": "ok"}
