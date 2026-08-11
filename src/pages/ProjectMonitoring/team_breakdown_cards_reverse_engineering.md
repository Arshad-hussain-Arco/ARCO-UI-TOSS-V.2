# TEAM BREAKDOWN CARDS / COUNT BY — LEGACY LOGIC & API VALIDATION EXTRACTION

> [!IMPORTANT]
> **REVERSE-ENGINEERING REFERENCE DOCUMENT**  
> This specification documents the verified-correct, exact implementation of the **Team Breakdown Cards** ("Count By" cards) in the legacy application (`c:\git\toss\ARCO-RE-UI-TOSS`). All source code references, data transformations, API schemas, and validation logic correspond strictly to the legacy functional reference.

---

## 1. IMPLEMENTATION FILE MAP

Below is the complete file breakdown of every component, hook, service, utility, constant, and schema responsible for generating the 7 Count By cards.

```
ProjectManagementPage (Parent Page)
  └─ ProjectManagement.js (State & Data Fetcher)
       └─ CountsCard.js (Card ID 1 through 7)
            └─ PrimeReact ListBox (Renders Name & Green Count Badge)
                 └─ Project.js (Modal Detail Dialog on Row Click)
```

| File Path | Function / Component | Purpose | Used By | Related Count By Cards |
|---|---|---|---|---|
| [`src/Components/ProjectManagement/ProjectManagement.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js) | `ProjectManagement` (Class Component) | Parent page component. Calls API, maintains global state (`FilterProjectData`, `FilteredCRData`), handles Project Type radio button filtering, and instantiates `<CountsCard>` for cards 1 to 7. | Router / Navigation | Cards 1–7 |
| [`src/Components/ProjectManagement/CountsCard.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js) | `CountsCard` (Class Component) | Renders individual summary cards. Executes `loadComponentData()`, `myFunc()` array reduction, populates `<ListBox>` options with names and count badges, and triggers detail modals. | `ProjectManagement.js`, `ProjectBreaches.js` | Cards 1–7 |
| [`src/Components/ProjectManagement/CountsCard.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L80-L91) | `myFunc(obj, prop)` (Helper Function) | Generic reducer function. Groups array of objects by property key `prop` using `Array.prototype.reduce`. | `CountsCard.loadComponentData()` | Cards 1–7 |
| [`src/Components/ProjectManagement/ProjectManagement.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1341-L1360) | `buildProjectData(result)` (Data Transformer) | Parses raw `Wo_Id` to integer and maps `Status` strings to `StatusId` and `StatusGroup` via `StaticData.PMStatus`. | `ProjectManagement.loadProjectManagementData()` | Cards 1–5 (Work Orders) |
| [`src/Components/ProjectManagement/ProjectManagement.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L348-L394) | `onProjectTypeChange(...)` (Filter Utility) | Filters `FilterProjectData` by `Depends_On === projectType` and `FilteredCRData` by matching `Wo_Id`. | Radio button event handler | Cards 1–7 |
| [`src/Components/Services/ProjectManagementService.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Services/ProjectManagementService.js#L276-L278) | `getProjectManagementData(afterResponse)` | API service method. Sends HTTP request to endpoint `importworkorderstatusfile/0`. | `ProjectManagement.loadProjectManagementData()` | Cards 1–7 |
| [`src/Components/Services/OSSService.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Services/OSSService.js#L14-L21) | `requestJson(methodName, params, afterResponse)` | Base service class method. Builds URL path `${controllerPath}/${methodName}/${params}` and delegates to `OSSRequest.getJson`. | `ProjectManagementService.js` | Cards 1–7 |
| [`src/Components/Utils/OSSRequest.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Utils/OSSRequest.js) | `OSSRequest.getJson(url, ...)` | Low-level HTTP utility executing `fetch` GET request. | `OSSService.js` | Cards 1–7 |
| [`src/Languages/EnTextContent.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Languages/EnTextContent.js#L247-L253) | `TextEngine` (Constant / Class) | Supplies localized card header title strings. | `ProjectManagement.cardData` | Cards 1–7 |
| [`src/Components/ProjectManagement/Project.js`](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Project.js) | `Project` (Class Component) | Detail modal dialog displaying filtered work orders or CRs when a user clicks on a person row in `<CountsCard>`. | `CountsCard.render()` | Cards 1–7 |

---

## 2. API SPECIFICATION

The legacy application fetches the exact data payload for Count By cards via the following endpoint setup:

- **Endpoint Path**: `${AppConfig.api.url}/pm/importworkorderstatusfile/0`
- **HTTP Method**: `GET`
- **API Service Function**: `OSSSystem.services.projectManagementService.getProjectManagementData(afterResponse)`
- **Base Controller Path**: `${AppConfig.api.url}/pm` (configured in `src/OSSSystem.js` via `setControllerPath`)
- **Request Parameters**: Path Parameter `0` (indicates default full-file import fetch: `/importworkorderstatusfile/0`)
- **Query Parameters**: None
- **Request Body**: None (HTTP GET)
- **Headers**:
  ```http
  Accept: application/json
  Content-Type: application/json
  ```
- **Pagination Parameters**: None (The legacy API returns the entire dataset in a single call).
- **Sorting Parameters**: None (No server-side sorting specified; client receives raw order).
- **Filters**: None (No request-level filters; all filtering is performed client-side).

---

## 3. COMPLETE API RESPONSE STRUCTURE

The API returns a root JSON object containing two main record arrays (`result1` and `result2`):

```json
{
  "isSuccess": true,
  "result1": [
    {
      "Wo_Id": "1001",
      "Ipm_Number": "IPM-2024-001",
      "Summary": "Upgrade Payment Gateway Integration",
      "Status": "In Development",
      "IT_Delivery_Lead": "Alice Smith",
      "Product_Owner": "Bob Jones",
      "Backup_IT_Delivery_Lead": "Charlie Brown",
      "SIT_Lead": "David Wilson",
      "UAT_Lead": "Emma Davis",
      "Depends_On": "Digital",
      "Start_Date": "2024-01-15",
      "Due_Date": "2024-06-30",
      "SIT_Received_date": "2024-04-10",
      "UAT_Actual_End_Date": "2024-06-15",
      "Last_Comment": "1. Jan 10, 2024: Development in progress"
    }
  ],
  "result2": [
    {
      "Wo_Id": 1001,
      "Assigned_Developer": "Frank Miller",
      "Additional_Developers": "Grace Hopper",
      "Status": "Development In Progress",
      "Start_Date": "2024-02-01",
      "End_Date": "2024-05-15",
      "Effort_in_MDs": "25"
    }
  ]
}
```

### Data Field Dictionary

1. **`result1` (Work Orders / Projects Array)**:
   - `Wo_Id` *(String \| Number)*: Unique Work Order / Project primary key. Standardized to integer via `parseInt()` in `buildProjectData`.
   - `Ipm_Number` *(String)*: Project display code / code identifier.
   - `Summary` *(String)*: Project summary title / description.
   - `Status` *(String)*: Lifecycle status text (e.g., `"Open"`, `"In Development"`, `"Testing Blocked"`, `"Deferred"`, `"Completed"`).
   - `IT_Delivery_Lead` *(String)*: Name of assigned IT Delivery Lead.
   - `Product_Owner` *(String)*: Name of assigned Product Owner.
   - `Backup_IT_Delivery_Lead` *(String)*: Name of assigned Backup ITDL.
   - `SIT_Lead` *(String)*: Name of assigned SIT Lead.
   - `UAT_Lead` *(String)*: Name of assigned UAT Lead.
   - `Depends_On` *(String)*: Project domain classification used by the top Radio Button filter (e.g., `"Digital"`, `"Core Banking"`, `"Not Available"`).

2. **`result2` (Change Requests Array)**:
   - `Wo_Id` *(Number \| String)*: Foreign key referencing parent `result1[].Wo_Id`.
   - `Assigned_Developer` *(String)*: Name of primary assigned developer.
   - `Additional_Developers` *(String)*: Name of additional assigned developer(s).
   - `Status` *(String)*: CR status (e.g., `"Open"`, `"Development In Progress"`).
   - `Start_Date` *(String)*: Planned start date.
   - `End_Date` *(String)*: Planned end date.
   - `Effort_in_MDs` *(String \| Number)*: Effort estimated in man-days.

---

## 4. EXACT ROLE → API FIELD MAPPING TABLE

| Count By Card | Exact API Field | Nested Path | ID Field (Record PK / FK) | Display Field | Target Source Payload |
|---|---|---|---|---|---|
| **1. Count by IT Delivery Lead** | `IT_Delivery_Lead` | `result1[].IT_Delivery_Lead` | `Wo_Id` | `IT_Delivery_Lead` (Key string) | `result1` (Work Orders) |
| **2. Count by Product Owner** | `Product_Owner` | `result1[].Product_Owner` | `Wo_Id` | `Product_Owner` (Key string) | `result1` (Work Orders) |
| **3. Count by Backup ITDL** | `Backup_IT_Delivery_Lead` | `result1[].Backup_IT_Delivery_Lead` | `Wo_Id` | `Backup_IT_Delivery_Lead` (Key string) | `result1` (Work Orders) |
| **4. Count by SIT Lead** | `SIT_Lead` | `result1[].SIT_Lead` | `Wo_Id` | `SIT_Lead` (Key string) | `result1` (Work Orders) |
| **5. Count by UAT Lead** | `UAT_Lead` | `result1[].UAT_Lead` | `Wo_Id` | `UAT_Lead` (Key string) | `result1` (Work Orders) |
| **6. Count by Developer** | `Assigned_Developer` | `result2[].Assigned_Developer` | `Wo_Id` (in CR record) | `Assigned_Developer` (Key string) | `result2` (Change Requests) |
| **7. Count by Additional Developer** | `Additional_Developers` | `result2[].Additional_Developers` | `Wo_Id` (in CR record) | `Additional_Developers` (Key string) | `result2` (Change Requests) |

---

## 5. COMPLETE STEP-BY-STEP DATA PROCESSING PIPELINE

```
API REQUEST (GET /pm/importworkorderstatusfile/0)
       ↓
API RESPONSE ({ isSuccess: true, result1: [...], result2: [...] })
       ↓
RAW RECORDS (res.result1 & res.result2)
       ↓
FIELD EXTRACTION & DATA PREPARATION (buildProjectData)
       ↓
FILTERING (Project Type Radio Button Filter)
       ↓
VALIDATION & KEY EXTRACTION (CountsCard.loadComponentData)
       ↓
TRANSFORMATION & GROUPING (myFunc / Array.prototype.reduce)
       ↓
NORMALIZATION (Raw String Keys)
       ↓
COUNTING (groupedObject[key].length)
       ↓
SORTING (JS Object insertion order)
       ↓
DISPLAY (PrimeReact ListBox with Name & Green Count Badge)
```

### Detailed Pipeline Phase Descriptions

#### 1. API REQUEST & RESPONSE
- Invoked via `componentDidMount()` in `ProjectManagement.js`.
- Endpoint: `GET /pm/importworkorderstatusfile/0`.
- Response parsed: `res.result1` (Work Orders) and `res.result2` (Change Requests).

#### 2. FIELD EXTRACTION & PREPARATION (`buildProjectData`)
- `ProjectManagement.js` iterates `res.result1`:
  ```javascript
  buildProjectData(result) {
    const pmData = [];
    for (const myrow of result) {
      if (myrow.Wo_Id) {
        myrow.Wo_Id = parseInt(myrow.Wo_Id);
      }
      if (myrow.Status) {
        const myStatus = StaticData.PMStatus.find((x) => x.name === myrow.Status);
        if (myStatus) {
          myrow.StatusId = myStatus.id;
          myrow.StatusGroup = myStatus.groupid;
        }
      }
      pmData.push(myrow);
    }
    return pmData;
  }
  ```

#### 3. CLIENT-SIDE FILTERING (`onProjectTypeChange`)
- **Radio Button Project Type Filter**:
  - If `selectedPM === "All Projects"`:
    - `FilterProjectData = res.result1`
    - `FilteredCRData = res.result2`
  - If `selectedPM === "Digital"` (or any specific domain type):
    - `FilterProjectData = res.result1.filter(prj => prj.Depends_On === projectType)`
    - `filteredProjIds = FilterProjectData.map(obj => obj.Wo_Id)`
    - `FilteredCRData = res.result2.filter(obj => filteredProjIds.includes(obj.Wo_Id))`
- > [!NOTE]
  > **Top Search Bar Filters**: Search filters (`IPM_number`, `ITDLSearch`, `ProductOwnerSearch`, `startDateSearch`, `endDateSearch`, `selectedStatusSearch`) filter `FilterProjectGridData` for the main data table ONLY. They **DO NOT** filter `FilterProjectData` or `FilteredCRData` passed to `CountsCard`.

#### 4. GROUPING & TRANSFORMATION (`CountsCard.js`)
- `CountsCard` receives `data` (`FilterProjectData`) and `crdata` (`FilteredCRData`).
- In `loadComponentData()`, a `switch(cardid)` statement selects the target collection and field:
  - Cards 1–5: `groupedObject = myFunc(this.props.data, fieldName)`
  - Cards 6–7: `groupedObject = myFunc(this.props.crdata, fieldName)`

- Reducer Implementation (`myFunc`):
  ```javascript
  myFunc(obj, prop) {
    return obj.reduce(function (acc, item) {
      let key = item[prop];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  }
  ```

#### 5. LEGACY VALIDATION & KEY NORMALIZATION RULES
- **No Sanitization / Trimming**: The legacy code uses exact raw property values `item[prop]` directly as object keys.
- **Null / Undefined Handling**: If `item[prop]` is `null` or `undefined`, JavaScript coerces it to the object property string `"null"` or `"undefined"`.
- **Empty String**: If `item[prop] === ""`, it creates an empty string key `""`.
- **Whitespace Sensitivity**: `" John "` and `"John"` create two distinct group keys.
- **Case Sensitivity**: `"JOHN"` and `"John"` create two distinct group keys.

#### 6. COUNTING & OBJECT MAPPING
- For Cards 1 to 5 (Work Orders):
  ```javascript
  Object.keys(groupedObject).forEach(function (arrayItem) {
    groupedArray.push({
      name: arrayItem,
      count: groupedObject[arrayItem]?.length,
      ProjList: groupedObject[arrayItem],
    });
  });
  ```
  - **Count Unit**: Work Order record count in `result1` matching key `arrayItem`.
  - **Deduplication**: None (each Work Order record in `result1` is counted).

- For Cards 6 & 7 (Change Requests):
  ```javascript
  Object.keys(groupedObject).forEach(function (arrayItem) {
    groupedArray.push({
      name: arrayItem,
      count: groupedObject[arrayItem]?.length,
      CRList: groupedObject[arrayItem],
      WOList: mySelf.props.data,
    });
  });
  ```
  - **Count Unit**: Change Request record count in `result2` matching key `arrayItem`.
  - **Deduplication**: None (each CR record in `result2` is counted).

#### 7. SORTING & DISPLAY
- **Sorting**: Legacy code relies on natural Object key insertion order returned by `Object.keys(groupedObject)`. No `.sort()` is applied.
- **Rendering**: Populates PrimeReact `<ListBox options={this.state.groupedList}>` using `ItemTemplate`:
  ```jsx
  ItemTemplate = (option) => (
    <div className="row my-0 py-0" onClick={() => this.onCountClick(option)}>
      <span className="col-md-10 d-flex align-items-center justify-content-start">
        <b className="fs-6">{option.name}</b>
      </span>
      <span className="col-md-2 d-flex align-items-center justify-content-end">
        <Badge bg="success" className="custom-tooltip-btn">{option.count}</Badge>
      </span>
      <hr className="m-0" />
    </div>
  );
  ```
- **Row Click Interaction**: Clicking a row opens `<Dialog>` rendering `<Project projectsData={option} cardid={cardid} CRData={crdata} />`.

---

## 6. EXACT CODE VERIFICATION EVIDENCE

### Evidence A: ProjectManagement.js Card Definitions
```javascript
// File: src/Components/ProjectManagement/ProjectManagement.js (Lines 123-134)
this.cardData = [
  { cardid: 1, title: OSSSystem.TextEngine.CountByITDeliveryLead, color: "greenyellow" },
  { cardid: 2, title: "Count BY Product Owner" },
  { cardid: 3, title: OSSSystem.TextEngine.CountByBackupITDL },
  { cardid: 4, title: OSSSystem.TextEngine.CountBySITLead },
  { cardid: 5, title: OSSSystem.TextEngine.CountByUATLead },
  { cardid: 6, title: OSSSystem.TextEngine.CountByDeveloper },
  { cardid: 7, title: OSSSystem.TextEngine.CountByAdditionalDeveloper }
];
```

### Evidence B: CountsCard.js Field Switch & Collection Routing
```javascript
// File: src/Components/ProjectManagement/CountsCard.js (Lines 97-122)
switch (this.props.cardid) {
  case 1:
    groupedObject = this.myFunc(this.props.data, "IT_Delivery_Lead");
    break;
  case 2:
    groupedObject = this.myFunc(this.props.data, "Product_Owner");
    break;
  case 3:
    groupedObject = this.myFunc(this.props.data, "Backup_IT_Delivery_Lead");
    break;
  case 4:
    groupedObject = this.myFunc(this.props.data, "SIT_Lead");
    break;
  case 5:
    groupedObject = this.myFunc(this.props.data, "UAT_Lead");
    break;
  case 6:
    groupedObject = this.myFunc(this.props.crdata, "Assigned_Developer");
    break;
  case 7:
    groupedObject = this.myFunc(this.props.crdata, "Additional_Developers");
    break;
  default:
    groupedObject = null;
}
```

### Evidence C: Service Method Definition
```javascript
// File: src/Components/Services/ProjectManagementService.js (Lines 276-278)
getProjectManagementData(afterResponse) {
  this.requestJson("importworkorderstatusfile", 0, afterResponse);
}
```
