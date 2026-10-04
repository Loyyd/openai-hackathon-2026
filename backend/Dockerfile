FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY shared ./shared
COPY backend ./backend
COPY ingestion/__init__.py ./ingestion/__init__.py
COPY ingestion/transport_adapter ./ingestion/transport_adapter
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
