# System Settings — API Reference

> **For the frontend team.**
> All endpoints documented here are live and tested against the running server.
> Base URL: `http://<server>:<port>` (e.g. `http://localhost:8000`)

---

## Authentication

Every request **must** include a JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /api/auth/login/`. Access tokens expire in **30 minutes** — refresh using `POST /api/auth/refresh/`.

---

## Table of Contents

| Tab | Endpoint(s) |
|---|---|
| [Environment Config](#1-environment-config-tab) | GET, UPDATE |
| [ImportFileConfig](#2-importfileconfig-tab) | GET, UPDATE, UPLOAD FILE |
| [CR File Matching Columns](#3-cr-file-matching-columns-tab) | GET LIST, UPDATE ROW |
| [WO File Matching Columns](#4-wo-file-matching-columns-tab) | GET LIST, UPDATE ROW |
| [Weekend Configuration](#5-weekend-configuration-tab) | GET, UPDATE |
| [Home Management](#6-home-management-tab) | GET LIST, CREATE, UPDATE, DELETE |

---

## 1. Environment Config Tab

### `GET /api/env-admin/environment-config/`

Returns the 8 fields shown on the **Environment Config** tab.

**Request**
```
GET /api/env-admin/environment-config/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "id": 1,
  "module": "app",
  "clientDirectory": "/var/lib/toss/clients",
  "ImpLinksPath": "/etc/toss/config/links.json",
  "systemHealthHeartbeat": 20,
  "eodHeartbeatInterval": 60,
  "envConfigServerIp": "192.168.0.98",
  "envConfigPort": 22,
  "envConfigUsername": "sourcesftp",
  "envConfigPassword": "sourcesftp123"
}
```

> **Note:** `id` and `module` are returned so the frontend can pass them back to the Update endpoint below.

---

### `POST /api/env-admin/update-config/` ← shared Update endpoint for all config tabs

Saves changes for **Environment Config**, **ImportFileConfig**, and any other system config tab.
Send the full config object — it fully replaces the stored config_json.

**Request**
```
POST /api/env-admin/update-config/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "id": 1,
  "module": "app",
  "configuration": {
    "clientDirectory": "/var/lib/toss/clients",
    "ImpLinksPath": "/etc/toss/config/links.json",
    "systemHealthHeartbeat": 20,
    "eodHeartbeatInterval": 60,
    "envConfigServerIp": "192.168.0.98",
    "envConfigPort": 22,
    "envConfigUsername": "sourcesftp",
    "envConfigPassword": "sourcesftp123",
    "workOrderStatusFilePath": "/upload/csvfiles/oss/WO_All_Columns.csv",
    "changeRequestFilePath": "/upload/csvfiles/oss/CR_Status_2_modified_dates2.csv",
    "runTimeFilePath": "/upload/csvfiles/oss/Murex-RuntimeTrends-2026-02-03.parquet",
    "changeRequestServerIp": "192.168.0.98",
    "changeRequestPort": 22,
    "changeRequestUsername": "sourcesftp",
    "changeRequestPassword": "sourcesftp123",
    "weekendDays": [0, 6]
  }
}
```

> IMPORTANT: The `configuration` object must include ALL existing keys — this is a full replace, not a partial patch.
> Fetch the current config via `GET /api/env-admin/all-configs/` first, merge your changes, then send the full object.

**Response — 200 OK**
```json
{
  "isSuccess": true,
  "message": "configuration record with id 1 updated successfully"
}
```

**Response — 400 Bad Request**
```json
{
  "isSuccess": false,
  "message": { "id": ["This field is required."] }
}
```

---

## 2. ImportFileConfig Tab

### `GET /api/env-admin/import-file-config/`

Returns the 8 fields shown on the **ImportFileConfig** tab.

**Request**
```
GET /api/env-admin/import-file-config/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "id": 1,
  "module": "app",
  "workOrderStatusFilePath": "/upload/csvfiles/oss/WO_All_Columns_with_Last_Comment_Date_br.csv",
  "changeRequestFilePath": "/upload/csvfiles/oss/CR_Status_2_modified_dates2.csv",
  "runTimeFilePath": "/upload/csvfiles/oss/Murex-RuntimeTrends-2026-02-03.parquet",
  "ImpLinksPath": "/upload/Documents",
  "changeRequestServerIp": "192.168.0.98",
  "changeRequestPort": 22,
  "changeRequestUsername": "sourcesftp",
  "changeRequestPassword": "sourcesftp123"
}
```

> To save changes, use `POST /api/env-admin/update-config/` (see above).

---

### `POST /api/env-admin/upload-file/` ← File Upload (WO / CR / Runtime)

Uploads a file to the SFTP server and updates the corresponding file path in the config.

**Request — multipart/form-data**
```
POST /api/env-admin/upload-file/
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| file    | File   | YES      | The file to upload |
| fileKey | String | YES      | One of: wofilePath, crfilePath, runTimeFilePath, ImpLinksPath |

**Response — 200 OK**
```json
{
  "isSuccess": true,
  "message": "File uploaded successfully to /upload/csvfiles/oss/WO_All_Columns.csv"
}
```

**Response — 400 Bad Request**
```json
{
  "isSuccess": false,
  "message": "No file provided"
}
```

---

## 3. CR File Matching Columns Tab

### `GET /api/capacity-planning/cr-columns/`

Returns all CR column mapping rows (Code Column to Excel Column), sorted by code_col.

**Request**
```
GET /api/capacity-planning/cr-columns/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "code_col": "Additional_Developers",
    "excel_col": "Additional Developers"
  },
  {
    "id": 2,
    "code_col": "Assigned_Developer",
    "excel_col": "Assigned Programmer"
  },
  {
    "id": 3,
    "code_col": "Effort_in_MDs",
    "excel_col": "Proposed Effort in MDs"
  },
  {
    "id": 4,
    "code_col": "End_Date",
    "excel_col": "End Date"
  },
  {
    "id": 5,
    "code_col": "Id",
    "excel_col": "Id"
  },
  {
    "id": 6,
    "code_col": "Priority",
    "excel_col": "Priority"
  },
  {
    "id": 7,
    "code_col": "Project",
    "excel_col": "Project"
  },
  {
    "id": 8,
    "code_col": "Start_Date",
    "excel_col": "Start Date"
  },
  {
    "id": 9,
    "code_col": "Status",
    "excel_col": "Status Information"
  }
]
```

---

### `PUT /api/capacity-planning/cr-columns/<id>/update/`

Updates a single CR column mapping row. Both code_col and excel_col are editable.

**Request**
```
PUT /api/capacity-planning/cr-columns/1/update/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "code_col": "Additional_Developers",
  "excel_col": "Additional Developers"
}
```

**Response — 200 OK**
```json
{
  "message": "CR column mapping id 1 updated successfully.",
  "data": {
    "id": 1,
    "code_col": "Additional_Developers",
    "excel_col": "Additional Developers"
  }
}
```

**Response — 404 Not Found**
```json
{
  "detail": "CR column mapping with id 99 not found."
}
```

**Response — 400 Bad Request**
```json
{
  "code_col": ["This field is required."],
  "excel_col": ["This field is required."]
}
```

> Cache note: Saving a CR column mapping automatically clears the server-side cache for capacity planning
> and work-order data, so the next data fetch will use the updated mapping.

---

## 4. WO File Matching Columns Tab

Identical structure to CR — same fields, same validation, separate table.

### `GET /api/capacity-planning/wo-columns/`

Returns all WO column mapping rows sorted by code_col.

**Request**
```
GET /api/capacity-planning/wo-columns/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "code_col": "Attachments",
    "excel_col": "Attachment"
  },
  {
    "id": 2,
    "code_col": "Backup_IT_Delivery_Lead",
    "excel_col": "Backup IT Delivery Lead"
  },
  {
    "id": 3,
    "code_col": "Clarity_Planned_Finish_Date",
    "excel_col": "Clarity Planned Finish Date"
  }
]
```

---

### `PUT /api/capacity-planning/wo-columns/<id>/update/`

Updates a single WO column mapping row.

**Request**
```
PUT /api/capacity-planning/wo-columns/1/update/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "code_col": "Attachments",
  "excel_col": "Attachment"
}
```

**Response — 200 OK**
```json
{
  "message": "WO column mapping id 1 updated successfully.",
  "data": {
    "id": 1,
    "code_col": "Attachments",
    "excel_col": "Attachment"
  }
}
```

**Response — 404 Not Found**
```json
{
  "detail": "WO column mapping with id 99 not found."
}
```

---

## 5. Weekend Configuration Tab

### `GET /api/env-admin/weekend-config/`

Returns the currently configured weekend days.

**Request**
```
GET /api/env-admin/weekend-config/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "id": 1,
  "module": "app",
  "weekendDays": [0, 6]
}
```

Day number convention:

| Value | Day       |
|-------|-----------|
| 0     | Sunday    |
| 1     | Monday    |
| 2     | Tuesday   |
| 3     | Wednesday |
| 4     | Thursday  |
| 5     | Friday    |
| 6     | Saturday  |

> If no weekend days have been configured yet, weekendDays returns [].

---

### `PUT /api/env-admin/weekend-config/`

Saves the selected weekend days.

**Request**
```
PUT /api/env-admin/weekend-config/
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "weekendDays": [0, 6]
}
```

> Send an empty array [] to clear all weekend days.

**Response — 200 OK**
```json
{
  "id": 1,
  "module": "app",
  "weekendDays": [0, 6],
  "message": "Weekend configuration updated successfully."
}
```

**Response — 400 Bad Request** (missing field)
```json
{
  "detail": "'weekendDays' is required."
}
```

**Response — 400 Bad Request** (invalid value)
```json
{
  "detail": "Invalid day values: [7]. Each value must be an integer 0-6."
}
```

---

## 6. Home Management Tab

### `GET /api/dashboard/home-data/`

Returns all home cards sorted by description.

**Request**
```
GET /api/dashboard/home-data/
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "photo": "iVBORw0KGgoAAAANSUhEUgAA...",
    "description": "arcofintech is an AI and robotics company focused on developing intelligent financial software systems..."
  },
  {
    "id": 2,
    "photo": null,
    "description": "Located in the temperate northwest of Saudi Arabia, the Diriyah Gate development blends rich cultural heritage..."
  }
]
```

> `photo` is a base64-encoded string of the image binary. Render it as:
>   <img src="data:image/jpeg;base64,{photo}" />
> If no image was uploaded, `photo` is null.

---

### `POST /api/dashboard/home-data/create/`

Creates a new home card.

**Request — multipart/form-data**
```
POST /api/dashboard/home-data/create/
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Field       | Type         | Required | Description |
|-------------|--------------|----------|-------------|
| photo       | File (image) | NO       | Card banner image |
| description | String       | NO       | Card description text |

> Both fields are optional — you can create a card with just a description, just a photo, or both.

**Response — 201 Created**
```json
{
  "id": 4,
  "photo": "iVBORw0KGgoAAAANSUhEUgAA...",
  "description": "New card description text"
}
```

---

### `PUT /api/dashboard/home-data/<id>/update/`

Updates an existing home card.

**Request — multipart/form-data**
```
PUT /api/dashboard/home-data/1/update/
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Field       | Type         | Required | Description |
|-------------|--------------|----------|-------------|
| photo       | File (image) | NO       | New image — omit to keep existing photo |
| description | String       | NO       | New text — omit to keep existing description |

> Partial update: Only the fields you send are changed.
> Omitting `photo` preserves the stored image.
> Omitting `description` preserves the existing text.

**Response — 200 OK**
```json
{
  "id": 1,
  "photo": "iVBORw0KGgoAAAANSUhEUgAA...",
  "description": "Updated description text"
}
```

**Response — 404 Not Found**
```json
{
  "detail": "HomeConfig card with id 99 not found."
}
```

---

### `DELETE /api/dashboard/home-data/<id>/delete/`

Permanently deletes a home card.

**Request**
```
DELETE /api/dashboard/home-data/1/delete/
Authorization: Bearer <token>
```

**Response — 204 No Content** (success, empty body)

**Response — 404 Not Found**
```json
{
  "detail": "HomeConfig card with id 99 not found."
}
```

---

## Common Error Responses

| Status | When |
|--------|------|
| 401 Unauthorized       | Missing or expired JWT token |
| 400 Bad Request        | Validation error — check the response body for field-level details |
| 404 Not Found          | Resource with that id does not exist |
| 500 Internal Server Error | System configuration not found or malformed on the server |

---

## Quick Reference — All Endpoints

| Method | Endpoint | UI Tab | Description |
|--------|----------|--------|-------------|
| GET    | /api/env-admin/environment-config/              | Environment Config    | Get 8 env config fields |
| POST   | /api/env-admin/update-config/                   | All config tabs       | Save full system config |
| GET    | /api/env-admin/import-file-config/              | ImportFileConfig      | Get 8 import file config fields |
| POST   | /api/env-admin/upload-file/                     | ImportFileConfig      | Upload WO/CR/Runtime file via SFTP |
| GET    | /api/capacity-planning/cr-columns/              | CR File Matching      | List all CR column mappings |
| PUT    | /api/capacity-planning/cr-columns/<id>/update/  | CR File Matching      | Update a CR column mapping |
| GET    | /api/capacity-planning/wo-columns/              | WO File Matching      | List all WO column mappings |
| PUT    | /api/capacity-planning/wo-columns/<id>/update/  | WO File Matching      | Update a WO column mapping |
| GET    | /api/env-admin/weekend-config/                  | Weekend Configuration | Get current weekend days |
| PUT    | /api/env-admin/weekend-config/                  | Weekend Configuration | Save selected weekend days |
| GET    | /api/dashboard/home-data/                       | Home Management       | List all home cards |
| POST   | /api/dashboard/home-data/create/                | Home Management       | Create a new home card |
| PUT    | /api/dashboard/home-data/<id>/update/           | Home Management       | Update a home card |
| DELETE | /api/dashboard/home-data/<id>/delete/           | Home Management       | Delete a home card |
