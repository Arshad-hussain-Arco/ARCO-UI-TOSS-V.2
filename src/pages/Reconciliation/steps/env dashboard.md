
## 7. Environment Dashboard Tab

### `GET /api/env-admin/env-dashboard/`

Returns all environment configuration cards and the aggregated list of environments and their components.

**Request**
```
GET /api/env-admin/env-dashboard/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "configs": [
    {
      "id": 22,
      "feature": "Infra",
      "file_name": "Infra.csv",
      "file_location": "/upload/csvfiles/oss/",
      "user_name": "ar",
      "modified_date": "2026-07-29"
    },
    {
      "id": 1,
      "feature": "Status",
      "file_name": "status.csv",
      "file_location": "/upload/csvfiles/oss/",
      "user_name": "admin",
      "modified_date": "2026-07-29"
    }
  ],
  "env_details": [
    {
      "name": "UAT",
      "status": "ACTIVE",
      "team": "Testing Team",
      "servers_count": 9,
      "db_hosts_count": 2,
      "rtbs_status": "RTBS Not Connected",
      "components": [
        {
          "name": "App Directory",
          "type": "Directory",
          "endpoint": "/sys/app_dr",
          "status": "HEALTHY"
        },
        {
          "name": "UAT-DB",
          "type": "DB Host",
          "endpoint": "10.1.1.1",
          "status": "HEALTHY"
        },
        {
          "name": "UAT-APP-01",
          "type": "App Server",
          "endpoint": "10.1.1.1",
          "status": "HEALTHY"
        },
        {
          "name": "UAT-BUS-01",
          "type": "Bus Server",
          "endpoint": "10.1.1.1",
          "status": "HEALTHY"
        }
      ]
    }
  ]
}
```

---

### `GET /api/env-admin/env-details/<env_name>/`

Triggered when expanding an environment. Connects to SFTP, searches all configured files, and returns the raw rows matching the environment name (e.g. `UAT`).

**Request**
```
GET /api/env-admin/env-details/UAT/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "environment": "UAT",
  "files_data": [
    {
      "config_id": 22,
      "feature": "Infra",
      "file_name": "Infra.csv",
      "data": {
        "ENV_NAME": "UAT",
        "APPLICATION_DIRECTORY": "/sys/app_dr",
        "ORC1_SERVER": "rhl001ap.dom.local",
        "ORC1_IP": "10.1.1.1",
        "DB_HOST": "rhl010db",
        "DB_IP": "10.1.1.1"
      }
    },
    {
      "config_id": 1,
      "feature": "Status",
      "file_name": "status.csv",
      "data": {
        "ENV_NAME": "UAT",
        "USAGE": "Testing",
        "OWNER": "Testing Team",
        "RTBS_CONNECTED": "Not Connected",
        "SYS_VERSION": "2.1.4.1"
      }
    }
  ]
}
```

---

### `POST /api/env-admin/env-config/create/`

Adds a new environment configuration card. Verifies that the file exists on the remote SFTP server at the given location before saving.

**Request**
```
POST /api/env-admin/env-config/create/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "feature": "Infra",
  "file_name": "uat_infrastructure.csv",
  "file_location": "/configs/infra/"
}
```

**Response — 201 Created**
```json
{
  "message": "Environment Configuration added successfully",
  "config": {
    "id": 64,
    "feature": "Infra",
    "file_name": "uat_infrastructure.csv",
    "file_location": "/configs/infra/",
    "user_name": "admin",
    "modified_date": "2026-07-30"
  }
}
```

**Response — 404 Not Found** (SFTP file doesn't exist)
```json
{
  "message": "Remote file not found at: /configs/infra/uat_infrastructure.csv"
}
```

---

### `PUT /api/env-admin/env-config/<id>/update/`

Updates an existing environment configuration card's fields. Verifies that the new file exists on the SFTP server if the path or filename is updated.

**Request**
```
PUT /api/env-admin/env-config/22/update/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "feature": "Infra",
  "file_name": "uat_infrastructure_v2.csv",
  "file_location": "/configs/infra/"
}
```

**Response — 200 OK**
```json
{
  "message": "Environment Configuration updated successfully",
  "config": {
    "id": 22,
    "feature": "Infra",
    "file_name": "uat_infrastructure_v2.csv",
    "file_location": "/configs/infra/",
    "user_name": "admin",
    "modified_date": "2026-07-30"
  }
}
```

---

### `DELETE /api/env-admin/env-config/<id>/delete/`

Deletes an environment configuration record from the database.

**Request**
```
DELETE /api/env-admin/env-config/22/delete/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "message": "Environment Configuration deleted successfully"
}