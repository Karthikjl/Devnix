# Judge0 CE - Local Setup

This repository contains the Docker Compose configuration for running **Judge0 Community Edition (CE)** locally.

---

## 🚀 How to Start Judge0

1. **Start the containers in detached mode:**
   ```powershell
   docker compose up -d
   ```

2. **Check container status:**
   ```powershell
   docker compose ps
   ```

3. **View logs:**
   ```powershell
   docker compose logs -f
   ```

4. **Stop the containers:**
   ```powershell
   docker compose down
   ```

---

## 🧪 Testing the API

Judge0 server will be available at: `http://localhost:2358`

### 1. Check System Info & Health
```powershell
curl http://localhost:2358/system_info
curl http://localhost:2358/about
```

### 2. List Supported Languages
```powershell
curl http://localhost:2358/languages
```

### 3. Submit Code (e.g. Python 3 - Language ID 71)

#### Synchronous Submission (Wait for result):
```powershell
Invoke-RestMethod -Uri "http://localhost:2358/submissions?base64_encoded=false&wait=true" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"language_id": 71, "source_code": "print(\"Hello from Judge0!\")"}'
```

#### JavaScript (Node.js - Language ID 63):
```powershell
Invoke-RestMethod -Uri "http://localhost:2358/submissions?base64_encoded=false&wait=true" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"language_id": 63, "source_code": "console.log(\"Hello from Node.js!\");"}'
```

#### C++ (GCC 9.2.0 - Language ID 54):
```powershell
Invoke-RestMethod -Uri "http://localhost:2358/submissions?base64_encoded=false&wait=true" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"language_id": 54, "source_code": "#include <iostream>\nint main() { std::cout << \"Hello from C++!\"; return 0; }"}'
```

---

## ⚙️ Configuration

You can customize timeout, memory limits, and authentication keys inside [judge0.conf](file:///d:/Project/Devnix/judge0/judge0.conf).
