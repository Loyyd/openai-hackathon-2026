"""Request real camera collection through the backend worker."""
import os
import httpx

if __name__ == "__main__":
    response = httpx.post(os.getenv("BACKEND_URL", "http://localhost:8000") + "/api/cameras/capture", timeout=10)
    response.raise_for_status()
    print(response.json())
