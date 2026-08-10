# Use official lightweight Python 3.12 image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend agent source code
COPY . ./agent

# Expose HTTP port for API
EXPOSE 8000

# Default entrypoint to start FastAPI application using Uvicorn
CMD ["uvicorn", "agent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
