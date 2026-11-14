# One container = same shape as Vercel: React build served by FastAPI on one origin.

# --- 1. build the frontend ---------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- 2. run the API (and serve the built frontend) ---------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app backend/app
COPY data/lab_reports data/lab_reports
COPY --from=frontend /frontend/dist frontend/dist
RUN useradd --create-home appuser && mkdir -p backend/logs && chown -R appuser /app/backend/logs
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
