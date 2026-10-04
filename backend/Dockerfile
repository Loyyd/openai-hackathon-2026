FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./requirements.txt
COPY algorithms/requirements-vision.txt ./requirements-vision.txt
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt -r requirements-vision.txt
COPY shared ./shared
COPY backend ./backend
COPY ingestion/__init__.py ./ingestion/__init__.py
COPY ingestion/providers ./ingestion/providers
COPY algorithms ./algorithms
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
