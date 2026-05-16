import asyncio
import logging
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import SessionLocal, User, SavedLocation
from auth import hash_password, verify_password, create_access_token, get_current_user, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

WEATHER_CODES = {
    0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing Rime Fog",
    51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
    61: "Light Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    71: "Light Snow", 73: "Moderate Snow", 75: "Heavy Snow", 77: "Snow Grains",
    80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
    85: "Slight Snow Showers", 86: "Heavy Snow Showers",
    95: "Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail",
}

EXTREME_CODES = {95, 96, 99, 65, 67, 75, 82, 86}

AQI_LEVELS = [
    (50, "Good", "Air quality is satisfactory."),
    (100, "Moderate", "Sensitive individuals should limit prolonged outdoor exertion."),
    (150, "Unhealthy for Sensitive Groups", "Children, elderly, and respiratory patients should reduce outdoor activity."),
    (200, "Unhealthy", "Everyone should limit prolonged outdoor exertion."),
    (300, "Very Unhealthy", "Avoid outdoor activity. Keep windows closed."),
    (float("inf"), "Hazardous", "Stay indoors. Wear a mask if you must go out."),
]


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LocationRequest(BaseModel):
    city: str
    country: str = ""
    latitude: float
    longitude: float


class HomeLocationRequest(BaseModel):
    city: str
    latitude: float
    longitude: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Weather AI Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


async def fetch_openmeteo(lat: float, lon: float):
    async with httpx.AsyncClient(timeout=15) as client:
        weather_res, aqi_res, forecast_res = await asyncio.gather(
            client.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,surface_pressure,dew_point_2m,uv_index",
                "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max,sunrise,sunset",
                "timezone": "auto",
            }),
            client.get("https://air-quality-api.open-meteo.com/v1/air-quality", params={
                "latitude": lat, "longitude": lon,
                "current": "european_aqi,pm2_5,pm10,nitrogen_dioxide",
            }),
            client.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": lat, "longitude": lon,
                "hourly": "temperature_2m,precipitation,precipitation_probability,weather_code,apparent_temperature",
                "past_days": 3,
                "timezone": "auto",
            }),
        )
    weather_data = weather_res.json() if weather_res.status_code == 200 else None
    aqi_data = aqi_res.json() if aqi_res.status_code == 200 else {}
    forecast_data = forecast_res.json() if forecast_res.status_code == 200 else None
    return weather_data, aqi_data, forecast_data


async def fetch_openweathermap(lat: float, lon: float):
    return None


def get_aqi_info(european_aqi):
    for threshold, label, advice in AQI_LEVELS:
        if european_aqi <= threshold:
            return {"aqi": european_aqi, "label": label, "advice": advice}
    return {"aqi": european_aqi, "label": "Unknown", "advice": "No data."}


def build_weather_response(loc: dict, openmeteo: dict | None, aqi_data: dict, forecast_data: dict | None):
    data = {
        "city": loc["name"],
        "country": loc.get("country", ""),
        "temp": None, "feels_like": None, "humidity": None,
        "wind": None, "wind_gusts": None, "pressure": None, "dew_point": None, "uv_index": None,
        "code": None, "description": "Unknown",
        "aqi": None, "aqi_label": None, "aqi_advice": None, "aqi_pm25": None, "aqi_pm10": None,
        "summary": "", "recommendations": {},
        "daily_forecast": [], "hourly_history": [], "hourly_forecast": [],
    }

    if openmeteo:
        current = openmeteo.get("current", {})
        if current:
            data["temp"] = round(current.get("temperature_2m", 0))
            data["feels_like"] = round(current.get("apparent_temperature", 0))
            data["humidity"] = current.get("relative_humidity_2m", 0)
            data["wind"] = current.get("wind_speed_10m", 0)
            data["wind_gusts"] = current.get("wind_gusts_10m", 0)
            data["pressure"] = current.get("surface_pressure", 0)
            data["dew_point"] = round(current.get("dew_point_2m", 0)) if current.get("dew_point_2m") else None
            data["uv_index"] = round(current.get("uv_index", 0), 1) if current.get("uv_index") else None
            data["code"] = current.get("weather_code", 0)
            data["description"] = WEATHER_CODES.get(current.get("weather_code", 0), "Unknown")

        daily = openmeteo.get("daily", {})
        if daily and daily.get("time"):
            for i in range(len(daily["time"])):
                data["daily_forecast"].append({
                    "date": daily["time"][i],
                    "temp_max": round(daily["temperature_2m_max"][i]) if daily.get("temperature_2m_max") else None,
                    "temp_min": round(daily["temperature_2m_min"][i]) if daily.get("temperature_2m_min") else None,
                    "code": daily["weather_code"][i] if daily.get("weather_code") else None,
                    "precipitation_sum": round(daily["precipitation_sum"][i], 1) if daily.get("precipitation_sum") else None,
                    "precipitation_prob": daily["precipitation_probability_max"][i] if daily.get("precipitation_probability_max") else None,
                    "uv_index_max": round(daily["uv_index_max"][i], 1) if daily.get("uv_index_max") else None,
                    "wind_max": round(daily["wind_speed_10m_max"][i]) if daily.get("wind_speed_10m_max") else None,
                    "sunrise": daily["sunrise"][i] if daily.get("sunrise") else None,
                    "sunset": daily["sunset"][i] if daily.get("sunset") else None,
                })

    if forecast_data:
        hourly = forecast_data.get("hourly", {})
        if hourly and hourly.get("time"):
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
            for i in range(len(hourly["time"])):
                entry = {
                    "time": hourly["time"][i],
                    "temp": round(hourly["temperature_2m"][i]) if hourly.get("temperature_2m") else None,
                    "precipitation": hourly["precipitation"][i] if hourly.get("precipitation") else None,
                    "precipitation_prob": hourly["precipitation_probability"][i] if hourly.get("precipitation_probability") else None,
                    "code": hourly["weather_code"][i] if hourly.get("weather_code") else None,
                    "feels_like": round(hourly["apparent_temperature"][i]) if hourly.get("apparent_temperature") else None,
                }
                if hourly["time"][i] >= now:
                    data["hourly_forecast"].append(entry)
                else:
                    data["hourly_history"].append(entry)

    aqi_current = aqi_data.get("current", {}) if aqi_data else {}
    aqi_value = aqi_current.get("european_aqi")
    if aqi_value is not None:
        info = get_aqi_info(aqi_value)
        data["aqi"] = info["aqi"]
        data["aqi_label"] = info["label"]
        data["aqi_advice"] = info["advice"]
        data["aqi_pm25"] = round(aqi_current.get("pm2_5", 0), 1) if aqi_current.get("pm2_5") else None
        data["aqi_pm10"] = round(aqi_current.get("pm10", 0), 1) if aqi_current.get("pm10") else None

    data["summary"] = generate_summary(data)
    data["recommendations"] = recommend_activities(data)
    return data


def generate_summary(data):
    parts = [f"The current weather in {data['city']} is {data['description']} at {data['temp']}°C"]
    if data["feels_like"] is not None:
        diff = data["temp"] - data["feels_like"]
        if diff > 3:
            parts.append(f"it feels cooler at {data['feels_like']}°C — consider a light jacket")
        elif diff < -3:
            parts.append(f"it feels warmer at {data['feels_like']}°C due to humidity")
        else:
            parts.append(f"it feels close to the actual temperature")
    if data["humidity"] and data["humidity"] > 70:
        parts.append(f"humidity is high at {data['humidity']}%, making it feel sticky outdoors")
    elif data["humidity"] and data["humidity"] < 30:
        parts.append(f"the air is dry at {data['humidity']}% — stay hydrated")
    if data["wind"] and data["wind"] > 30:
        parts.append(f"wind is brisk at {data['wind']} km/h, so hold onto your hat")
    elif data["wind"] and data["wind"] > 15:
        parts.append(f"a light breeze at {data['wind']} km/h keeps things fresh")
    if data["uv_index"] is not None and data["uv_index"] > 6:
        parts.append(f"UV index is {data['uv_index']} — wear sunscreen if heading out")
    if data["aqi"] and data["aqi"] > 100:
        parts.append(f"air quality is {data['aqi_label']} at AQI {data['aqi']}, so limit prolonged outdoor exertion")
    return ". ".join(parts) + "."


def recommend_activities(data):
    temp = data.get("temp", 20)
    desc = data.get("description", "").lower()
    aqi = data.get("aqi", 0) or 0
    is_rainy = any(w in desc for w in ["rain", "drizzle", "thunderstorm", "shower"])
    is_snowy = any(w in desc for w in ["snow", "snow grains"])
    is_bad_air = aqi > 150

    if is_bad_air:
        return {"verdict": "Poor air quality — stay indoors.", "activities": ["Indoor workout", "Read", "Cook"], "clothing": ["Comfortable indoor wear"]}
    if is_rainy:
        return {"verdict": "Rainy day — perfect for cozy indoor time.", "activities": ["Café visit", "Movie", "Indoor climbing"], "clothing": ["Waterproof jacket", "Umbrella"]}
    if is_snowy:
        return {"verdict": "Snow day! Bundle up.", "activities": ["Build a snowman", "Sledding", "Hot chocolate"], "clothing": ["Winter coat", "Boots", "Gloves"]}
    if temp and temp > 30:
        return {"verdict": "Scorching hot — stay cool.", "activities": ["Swimming", "Early jog", "AC shopping"], "clothing": ["Light cotton", "Sunscreen", "Hat"]}
    if temp and temp < 10:
        return {"verdict": "Chilly outside — layer up.", "activities": ["Coffee shop", "Winter hike", "Netflix"], "clothing": ["Warm jacket", "Scarf", "Gloves"]}
    return {"verdict": "Great weather! Get outside.", "activities": ["Run", "Cycling", "Picnic"], "clothing": ["Comfortable wear", "Sunglasses"]}


def assess_severity(data: dict) -> str | None:
    code = data.get("code")
    if code in EXTREME_CODES:
        return f"Extreme weather: {WEATHER_CODES.get(code, 'Unknown')} in {data['city']}"
    if data.get("temp") and data["temp"] > 40:
        return f"Heatwave alert in {data['city']}: {data['temp']}°C"
    if data.get("temp") and data["temp"] < -10:
        return f"Extreme cold in {data['city']}: {data['temp']}°C"
    if data.get("wind") and data["wind"] > 60:
        return f"High wind warning in {data['city']}: {data['wind']} km/h"
    if data.get("aqi") and data["aqi"] > 200:
        return f"Hazardous air quality in {data['city']}: AQI {data['aqi']}"
    return None


async def check_alerts():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            locations = db.query(SavedLocation).filter(SavedLocation.user_id == user.id).all()
            if user.home_city:
                locations.append(SavedLocation(city=user.home_city, latitude=user.home_lat, longitude=user.home_lon))
            for loc in locations:
                if not loc.latitude or not loc.longitude:
                    continue
                try:
                    wdata, _, _ = await fetch_openmeteo(loc.latitude, loc.longitude)
                    if wdata and wdata.get("current"):
                        current = wdata["current"]
                        d = {"city": loc.city, "code": current.get("weather_code"), "temp": current.get("temperature_2m"), "wind": current.get("wind_speed_10m")}
                        severity = assess_severity(d)
                        if severity:
                            logger.warning(f"ALERT for {user.email}: {severity}")
                except Exception:
                    pass
    finally:
        db.close()


scheduler.add_job(check_alerts, "interval", hours=3, id="weather_alerts")


@app.get("/api/weather")
async def get_weather(city: str, lat: float = None, lon: float = None):
    if lat is not None and lon is not None:
        loc = {"name": city, "country": "", "latitude": lat, "longitude": lon}
        async with httpx.AsyncClient(timeout=15) as client:
            geo_res = await client.get("https://geocoding-api.open-meteo.com/v1/search", params={"name": city, "count": 1, "language": "en", "format": "json"})
            if geo_res.status_code == 200:
                geo = geo_res.json()
                if geo.get("results"):
                    loc["country"] = geo["results"][0].get("country", "")
    else:
        async with httpx.AsyncClient(timeout=15) as client:
            geo_res = await client.get("https://geocoding-api.open-meteo.com/v1/search", params={"name": city, "count": 1, "language": "en", "format": "json"})
            if geo_res.status_code != 200:
                raise HTTPException(502, "Geocoding unavailable")
            geo = geo_res.json()
            if not geo.get("results"):
                raise HTTPException(404, "City not found")
            loc = geo["results"][0]

    openmeteo, aqi, forecast = await fetch_openmeteo(loc["latitude"], loc["longitude"])
    return build_weather_response(loc, openmeteo, aqi, forecast)


@app.post("/api/auth/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter((User.email == body.email) | (User.username == body.username)).first():
        raise HTTPException(400, "Email or username already exists")
    user = User(email=body.email, username=body.username, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token({"sub": user.id}), "user": {"id": user.id, "email": user.email, "username": user.username}}


@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_access_token({"sub": user.id}), "user": {"id": user.id, "email": user.email, "username": user.username}}


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id, "email": user.email, "username": user.username,
        "home_city": user.home_city, "home_lat": user.home_lat, "home_lon": user.home_lon,
    }


@app.put("/api/auth/home")
def set_home(body: HomeLocationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.home_city = body.city
    user.home_lat = body.latitude
    user.home_lon = body.longitude
    db.commit()
    return {"ok": True}


@app.get("/api/locations")
def list_locations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    locs = db.query(SavedLocation).filter(SavedLocation.user_id == user.id).all()
    return [{"id": l.id, "city": l.city, "country": l.country, "latitude": l.latitude, "longitude": l.longitude} for l in locs]


@app.post("/api/locations")
def add_location(body: LocationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    loc = SavedLocation(user_id=user.id, city=body.city, country=body.country, latitude=body.latitude, longitude=body.longitude)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return {"id": loc.id, "city": loc.city, "country": loc.country}


@app.delete("/api/locations/{loc_id}")
def remove_location(loc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    loc = db.query(SavedLocation).filter(SavedLocation.id == loc_id, SavedLocation.user_id == user.id).first()
    if not loc:
        raise HTTPException(404, "Location not found")
    db.delete(loc)
    db.commit()
    return {"ok": True}


frontend_dist = Path(__file__).parent.parent / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/favicon.svg")
    async def favicon():
        return FileResponse(frontend_dist / "favicon.svg")

    @app.get("/icons.svg")
    async def icons():
        return FileResponse(frontend_dist / "icons.svg")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi"):
            raise HTTPException(404, "Not found")
        return FileResponse(frontend_dist / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
