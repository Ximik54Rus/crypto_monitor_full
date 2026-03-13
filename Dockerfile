FROM python:3.11-slim

WORKDIR /app

# Устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . .

# Запуск на $PORT (Railway requirement)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]
