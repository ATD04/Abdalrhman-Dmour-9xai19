FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY ./services/agent-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./shared /app/shared
COPY ./services/agent-service/ .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 8200

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8200/health')" || exit 1

# Run the service
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8200"]
