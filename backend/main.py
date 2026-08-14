from fastapi import FastAPI

app = FastAPI(title="Disaster Victim Detection API")


@app.get("/")
def read_root():
    return {"message": "Disaster Victim Detection Backend API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
