# Legacy Project Breaches Feature — Technical & Business Specification

This document details the reverse-engineered logic of the **Project Breaches** tab in the legacy application. It covers everything from API endpoints and response payloads to business logic rules, calculations, date parsing, UI mappings, state management, and critical bugs/side-effects.

---

## 1. File Map & Project Breaches Architecture

The Project Breaches feature is comprised of the following files:

### Component Dependency & Flow Map
```text
ProjectManagement (Parent Container)
  └─ ProjectBreaches (Tab Component)
       └─ CountsCard (Displays Summary Cards)
            └─ Project (Details Dialog)
                 └─ ProjectInfo1 (Single Project Deep Dive View)
                      └─ StatusBar (Circular Timeline Indicator)
```

### Relevant Files & Roles
1. **[ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js)**
   - **Purpose**: Main wrapper page containing the "Project Monitoring" and "Project Breaches" tabs.
   - **Role**: Manages the tab switching state (`SelectedPage` value `"breaches"`) and displays the overall last updated file timestamps (`lastupdated_wofile`, `lastupdated_crfile`) in the page title.
2. **[ProjectBreaches.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectBreaches.js)**
   - **Purpose**: Page component that acts as the entry point for the Project Breaches view.
   - **Role**: Initiates data fetching on mount, parses Work Order statuses, and instantiates three `CountsCard` components representing the three main breach areas: *Breaches*, *Due Dates*, and *CR Exceptions*.
3. **[CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js)**
   - **Purpose**: Summary card component containing a title header and a PrimeReact `ListBox` showing the names and counts of specific breach rules.
   - **Role**: Contains the core business logic, thresholds, calculations, and filters to evaluate breaches. On clicking a breach row, it triggers a details Dialog.
4. **[Project.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Project.js)**
   - **Purpose**: Detailed list modal shown when a specific breach category is selected.
   - **Role**: Renders a custom datatable of either Work Orders/Projects (`PMColumns`) or Change Requests (`CRColumns`). Provides global search filtering and exports table data.
5. **[ProjectInfo1.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js)**
   - **Purpose**: Single project deep-dive dialog containing structural info, timeline metrics, and lifecycle charts.
   - **Role**: Calculates and renders the Project Life Cycle durations (Planning, Development, Testing, Delivered) and status overdue days.
6. **[functions.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Utils/functions.js)**
   - **Purpose**: Shared utility file.
   - **Role**: Exposes `getFileUpdatedata` and `getFilesUpdatedata` wrapper functions to fetch data file timestamps.
7. **[ProjectManagementService.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Services/ProjectManagementService.js)**
   - **Purpose**: Centralized service class handling project-related HTTP requests.
   - **Role**: Declares the `getProjectManagementData`, `getFileUpdate`, and `getAllfilesUpdate` methods.
8. **[OSSRequest.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Utils/OSSRequest.js)**
   - **Purpose**: Network request handler.
   - **Role**: Wraps `XMLHttpRequest` with Bearer token authentication headers, status-code checking, and anti-cache parameters.
9. **[StaticData.json](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/StaticData.json)**
   - **Purpose**: Contains static arrays and configuration.
   - **Role**: Defines the `PMStatus` array (mapping project statuses to numeric `id` and `groupid`) and `PMStatusGroups`.

---

## 2. API Specifications

The Project Breaches feature relies on three GET/POST API endpoints.

### API 1: Project Management Data Fetching
- **Endpoint**: `${AppConfig.api.url}/pm/importworkorderstatusfile`
- **Method**: `GET`
- **Authentication**: Bearer Authorization token (`Bearer ${OSSSystem.Token}`) sent in request headers.
- **Request Parameters / Body**: None.
- **Trigger**: Called once during component initialization on mount.
- **Pagination**: All records are loaded at once. Pagination is handled entirely in the frontend.
- **Filtering & Sorting**: Frontend-driven. No parameters are passed.

### API 2: Single File Updated Timestamp
- **Endpoint**: `${AppConfig.api.url}/pm/getfile`
- **Method**: `POST`
- **Authentication**: Bearer Authorization token.
- **Request Body**:
  ```json
  { "file_name": "wofile" }
  ```
- **Trigger**: Called on mount of `ProjectBreaches.js`.

### API 3: All Files Updated Timestamps
- **Endpoint**: `${AppConfig.api.url}/pm/getallfiles`
- **Method**: `GET`
- **Authentication**: Bearer Authorization token.
- **Request Parameters / Body**: None.
- **Trigger**: Called on mount of `ProjectManagement.js`.

---

## 3. API Response Payload Schema

The expected payload format for the primary data-fetching API (`/pm/importworkorderstatusfile`) is as follows:

```json
{
  "isSuccess": true,
  "result1": [
    {
      "Wo_Id": "1001",
      "Ipm_Number": "IPM-876",
      "Summary": "Project alpha description",
      "Description": "Detailed project description text...",
      "Status": "FAT Testing",
      "Start_Date": "2026-01-10T00:00:00.000Z",
      "Due_Date": "2026-08-30T00:00:00.000Z",
      "Planned_DEV_completion_Date": "2026-06-15T00:00:00.000Z",
      "SIT_Received_date": "2026-05-01T00:00:00.000Z",
      "UAT_Actual_End_Date": "2026-07-20T00:00:00.000Z",
      "Last_Comment": "1. 23-Feb-2026: Testing completed.",
      "IT_Delivery_Lead": "Lead A",
      "Backup_IT_Delivery_Lead": "Lead B",
      "Product_Owner": "Owner A",
      "PMO_Project_Manager": "Manager A",
      "Owned_By": "Department A",
      "Clarity_Planned_Finish_Date": "2026-08-30T00:00:00.000Z",
      "Work_Order_Type": "Development",
      "Priority": "High",
      "Requestor_Name": "Requestor A"
    }
  ],
  "result2": [
    {
      "Wo_Id": 1001,
      "Ipm_Number": "CR-012",
      "Summary": "CR detailed summary",
      "Status": "Development In Progress",
      "Start_Date": "2026-02-10T00:00:00.000Z",
      "End_Date": "2026-05-15T00:00:00.000Z",
      "Effort_in_MDs": "15",
      "Assigned_Developer": "Dev X",
      "Additional_Developers": "Dev Y"
    }
  ]
}
```

### Complete Field Mappings

#### result1 (Work Orders / Projects)
| API Field | Type | Used By | Purpose |
|---|---|---|---|
| `Wo_Id` | string \| number | ProjectBreaches, Project, CountsCard | Unique project identifier (parsed to integer) |
| `Ipm_Number` | string | Project, ProjectInfo1 | Unique project code label |
| `Summary` | string | Project, ProjectInfo1 | Short summary description |
| `Description` | string | ProjectInfo1 | Full long-form project description |
| `Status` | string | ProjectBreaches, CountsCard, Project, ProjectInfo1 | Status string (mapped to ID/GroupID) |
| `Start_Date` | string (ISO Date) | CountsCard, ProjectInfo1 | Date when the project commenced |
| `Due_Date` | string (ISO Date) | CountsCard, ProjectInfo1 | Date when the project is scheduled to finish |
| `Planned_DEV_completion_Date` | string (ISO Date) | CountsCard, ProjectInfo1 | Expected date for development sign-off |
| `SIT_Received_date` | string (ISO Date) | CountsCard, ProjectInfo1 | Date SIT was officially initiated |
| `UAT_Actual_End_Date` | string (ISO Date) | ProjectInfo1 | Date UAT was completed |
| `Last_Comment` | string | CountsCard, Project, ProjectInfo1 | Full log of nested commentary |
| `IT_Delivery_Lead` | string | Project, ProjectInfo1 | Name of primary IT Lead |
| `Backup_IT_Delivery_Lead` | string | Project, ProjectInfo1 | Name of backup IT Lead |
| `Product_Owner` | string | Project, ProjectInfo1 | Name of Product Owner |
| `PMO_Project_Manager` | string | Project, ProjectInfo1 | Name of PMO Project Manager |
| `Owned_By` | string | ProjectInfo1 | Department or owner group name |
| `Clarity_Planned_Finish_Date` | string (ISO Date) | ProjectInfo1 | Original timeline finish date |
| `Work_Order_Type` | string | ProjectInfo1 | Type classification of work |
| `Priority` | string | ProjectInfo1 | Work urgency severity |
| `Requestor_Name` | string | ProjectInfo1 | Creator of project |

#### result2 (Change Requests)
| API Field | Type | Used By | Purpose |
|---|---|---|---|
| `Wo_Id` | string \| number | CountsCard, Project | Associated project ID |
| `Ipm_Number` | string | Project | CR Identifier |
| `Summary` | string | Project | CR title |
| `Status` | string | CountsCard, Project | Execution stage of the CR |
| `Start_Date` | string (ISO Date) | CountsCard, Project | Execution start date of CR |
| `End_Date` | string (ISO Date) | CountsCard, Project | Expected delivery due date of CR |
| `Effort_in_MDs` | string \| number | CountsCard, Project | Mandays size allocation |
| `Assigned_Developer` | string | Project | Primary developer assigned |
| `Additional_Developers` | string | Project | Supporting developers assigned |

---

## 4. API Field Transformations & Traces

### Field: `Wo_Id`
```text
result1[].Wo_Id (raw string e.g. "123")
  ↓
Parsed via parseInt()
  ↓
Stored in WOData as integer
  ↓
Matched against result2[].Wo_Id
```

### Field: `Status`
```text
result1[].Status (raw string e.g. "FAT Testing")
  ↓
Matched against StaticData.PMStatus[].name
  ↓
StatusId and StatusGroup extracted
  ↓
Used for threshold matching range boundaries (e.g. StatusId >= 8 && StatusId <= 12)
```

### Field: `Start_Date`
```text
result1[].Start_Date (raw string)
  ↓
Parsed via new Date()
  ↓
Subtracted from today (current time Date object)
  ↓
Converted to days using Math.ceil(diffTime / 86400000)
  ↓
Compared with limit threshold (e.g. > 60 days) to trigger breach
```

### Field: `Last_Comment`
```text
result1[].Last_Comment (raw text containing dates)
  ↓
Split into lines using numbered comment format: /(?:\n|^|\s{2,})(\d+\.)/
  ↓
Extracted date patterns from lines matching: /([A-Z][a-z]{2} \d{1,2}, \d{4})/
  ↓
Newest parsed date compared with today (midnight UTC)
  ↓
Difference in days evaluated: diff > 5 days triggers breach
```

---

## 5. Business Rules (Breach Logic)

### RULE ID: BR-001 — Unclosed Projects Started Before 60 Days
- **Condition**: The project start date is older than 60 days from today, and the project is not in a closed status.
- **Inputs**: `Start_Date`, `StatusId`, `Status`
- **Calculation**: 
  - `diffDays = Math.ceil(Math.abs(new Date() - new Date(Start_Date)) / (1000 * 60 * 60 * 24))`
- **Threshold**: `diffDays > 60`
- **Operator**: `>`
- **Exclusion Filters**: `StatusId !== 16` (Deployed), `StatusId !== 17` (Completed), and `Status !== "Deferred"`.
- **UI Impact**: Counts matching projects; renders inside "Breaches" list box.

### RULE ID: BR-002 — Project in Testing for more than 15 Days
- **Condition**: The project is in a testing status, and the date it was received in SIT is older than 15 days from today.
- **Inputs**: `SIT_Received_date`, `StatusId`
- **Calculation**: 
  - `diffDays = Math.ceil(Math.abs(new Date() - new Date(SIT_Received_date)) / (1000 * 60 * 60 * 24))`
- **Threshold**: `diffDays > 15` and `StatusId` is in range `[8, 12]` (inclusive).
- **Operator**: `>` and `>=`/`<=`
- **UI Impact**: Counts matching projects; renders inside "Breaches" list box.

### RULE ID: BR-003 — Project in BRD/SSD Stage for more than 14 Days (Bugged)
- **Condition**: The project start date is older than 14 days, and the status is simultaneously both 2 and 3.
- **Inputs**: `Start_Date`, `StatusId`
- **Calculation**: 
  - `diffDays = Math.ceil(Math.abs(new Date() - new Date(Start_Date)) / (1000 * 60 * 60 * 24))`
- **Threshold**: `diffDays > 14` and `StatusId === 2` (BRD Analysis) AND `StatusId === 3` (SSD Analysis).
- **Operator**: `&&` (Logical AND)
- **Bug Note**: Since `StatusId` can never be 2 and 3 at the same time, this rule **always yields 0 results** in the legacy application.
- **UI Impact**: Displays static count of `0`.

### RULE ID: BR-004 — Any CR whose due date passed (Bugged)
- **Condition**: The CR end date is in the past, and its status is simultaneously both "Open" and "Development In Progress".
- **Inputs**: `End_Date`, `Status` (Change Request status)
- **Threshold**: `CRdueDate < new Date()` and `Status === "Open"` AND `Status === "Development In Progress"`.
- **Operator**: `&&` (Logical AND)
- **Bug Note**: Since CR status can never be both strings simultaneously, this rule **always yields 0 results** in the legacy application.
- **UI Impact**: Displays static count of `0`.

### RULE ID: BR-005 — CR in progress stage, but WO moved to Testing (Bugged)
- **Condition**: The CR is open/in progress, but its parent Work Order has already moved to testing.
- **Inputs**: `result2[].Status`, `result2[].Wo_Id`, `result1[].Wo_Id`, `result1[].StatusId`
- **Threshold**: CR `Status` is `"Open"` or `"Development In Progress"`, and matching WO `StatusId >= 7` (FAT Testing and beyond).
- **Operator**: `>=`
- **Bug Note (Data Mutation Side-Effect)**: 
  This rule executes an assignment operator rather than a comparison within its first array filter:
  `obj.Wo_Id = x.Wo_Id && obj.StatusId >= 7`. 
  This mutates the `Wo_Id` values of all projects in the shared `WOData` array into booleans (`true` or `false`).
  Due to this corruption, the subsequent strict comparison `x.Wo_Id === obj.Wo_Id` (number compared to boolean) is always false, meaning this rule **always yields 0 results** and corrupts the parent dataset for other cards.
- **UI Impact**: Displays static count of `0`.

### RULE ID: BR-006 — CR in Open stage, but WO moved to Development (Bugged)
- **Condition**: The CR status is "Open", but its parent Work Order has already moved to development.
- **Inputs**: `result2[].Status`, `result2[].Wo_Id`, `result1[].Wo_Id`, `result1[].StatusId`
- **Threshold**: CR `Status` is `"Open"`, and matching WO `StatusId >= 5` (In Development and beyond).
- **Operator**: `>=`
- **Bug Note**: Affected by the data mutation side-effect in BR-005. Since `obj.Wo_Id` in `WOData` has already been mutated to a boolean, the match is never found, and this rule **always yields 0 results**.
- **UI Impact**: Displays static count of `0`.

### RULE ID: BR-007 — Projects with no comments for more than 5 days
- **Condition**: The project's latest comment timestamp is older than 5 days from today, excluding closed projects.
- **Inputs**: `Last_Comment`, `Status`
- **Calculation**: Extracted latest comment date parsed against UTC today date.
- **Threshold**: `diffDays > 5` and `Status !== "Closed"` and `Last_Comment !== ""`.
- **Operator**: `>`
- **UI Impact**: Counts matching projects; renders inside "Breaches" list box.

### RULE ID: BR-008 — Empty Planned Dev Completion in Next 45 Days
- **Condition**: The project's due date is within the next 45 days, but its Planned Dev Completion Date field is blank or missing.
- **Inputs**: `Due_Date`, `Planned_DEV_completion_Date`
- **Threshold**: `Planned_DEV_completion_Date === ""` or `length === 1`, and `Due_Date` is between today and `today + 45 days`.
- **Operator**: `==` and `>=`/`<=`
- **UI Impact**: Counts matching projects; renders inside "Due Dates" list box.

### RULE ID: BR-009 — Due Date - Dev Completion < 2 Weeks
- **Condition**: The variance between the project due date and its planned development completion date is less than 15 days.
- **Inputs**: `Due_Date`, `Planned_DEV_completion_Date`
- **Calculation**: 
  - `plDevDate = Planned_DEV_completion_Date === "" ? 0 : new Date(Planned_DEV_completion_Date)`
  - `diffDays = Math.ceil(Math.abs(new Date(Due_Date) - plDevDate) / 86400000)`
- **Threshold**: `diffDays < 15`
- **Operator**: `<`
- **UI Impact**: Counts matching projects; renders inside "Due Dates" list box.

### RULE ID: BR-010 — CR Due Date > WO Due Date (Bugged)
- **Condition**: The CR end date is later than the parent Work Order's due date.
- **Inputs**: `result2[].End_Date`, `result2[].Wo_Id`, `result1[].Wo_Id`, `result1[].Due_Date`
- **Operator**: `>` (Raw string comparison of `End_Date` string vs `Due_Date` string)
- **Bug Note**: Affected by the data mutation side-effect in BR-005. Because `pr.Wo_Id` is a boolean, `parseInt(pr.Wo_Id)` evaluates to `NaN`. The code tries to match `obj.Wo_Id === parseInt(pr.Wo_Id)`, which is always false. Thus, this rule **always yields 0 results**.
- **UI Impact**: Displays static count of `0`.

### RULE ID: BR-011 — No Man Days in CR
- **Condition**: The effort field of the Change Request is set to 0 or left blank.
- **Inputs**: `Effort_in_MDs`
- **Threshold**: `parseInt(Effort_in_MDs) === 0` or `Effort_in_MDs === ""`.
- **Operator**: `===`
- **UI Impact**: Counts matching CRs; renders inside "CR Exceptions" list box.

### RULE ID: BR-012 — No Start in CR
- **Condition**: The CR start date field is blank or contains a single character.
- **Inputs**: `Start_Date`
- **Threshold**: `Start_Date === ""` or `length === 1`.
- **Operator**: `==`
- **UI Impact**: Counts matching CRs; renders inside "CR Exceptions" list box.

### RULE ID: BR-013 — No Due Date in CR
- **Condition**: The CR end date field is blank or contains a single character.
- **Inputs**: `End_Date`
- **Threshold**: `End_Date === ""` or `length === 1`.
- **Operator**: `==`
- **UI Impact**: Counts matching CRs; renders inside "CR Exceptions" list box.

---

## 6. Calculations

### Calculation: Date Differences (Days)
- **Inputs**: `Date1` (Date object), `Date2` (Date object)
- **Formula**: `Math.ceil(Math.abs(Date1 - Date2) / (1000 * 60 * 60 * 24))`
- **Rounding**: Rounded up to the nearest whole integer using `Math.ceil()`.
- **Zero/Null Handling**: If either input is empty, `new Date()` results in `Invalid Date` and returns `NaN`. Evaluates to false under comparisons.

### Calculation: Project Timeline Status Percentage
- **Inputs**: `WOStartDate` (Start Date), `WOEndDate` (Due Date), `currentDate` (today)
- **Formula**: `Math.round(((currentDate - WOStartDate) * 100) / (WOEndDate - WOStartDate))`
- **Rounding**: Rounded to the nearest whole integer using `Math.round()`.
- **Overdue Handling**: If calculated percentage exceeds 100, the percentage value returned is the string `"-"`, and the status text is appended with `" ( Over Due for - [Days] Days)"` where Days is `Math.round(TotalCompletedDays - TotalExpectedDuration)`.

### Calculation: Project Life Cycle Durations
- **Planning**: `(minCRDevStartDate - WOStartDate) / 86400000`
- **Development**: `(maxCRDevEndDate - minCRDevStartDate) / 86400000`
- **Testing**: `(UAT_Actual_End_Date - SIT_Received_date) / 86400000`
- **Delivered**: `(Due_Date - Start_Date) / 86400000`

---

## 7. Date / Time Logic

- **Date Parsing**: Standard browser parser `new Date(dateString)` is used.
- **Timezone**: Dates are compared raw (as local timezone objects).
- **Current Date**: Generated in the frontend via `new Date()` (reflecting the client system local date and time).
- **Working Days**: All calculations use standard calendar days (no holiday or weekend filters are applied for breaches).
- **Invalid Dates**: Empty strings are checked via `=== ""` or `.length === 1`. Otherwise, bad date formats result in `NaN` during mathematical differences.

---

## 8. Filtering Logic

The data flows and filters in the following chronological order:

```text
API Response (GET /pm/importworkorderstatusfile)
  ↓
Build project statuses (mapping strings to IDs & adding fields)
  ↓
Extract file timestamps (via separate POST /pm/getfile)
  ↓
Evaluate breach rules (filtering lists based on BR-001 to BR-013)
  ↓
Mutate WOData Wo_Id to boolean (Side-effect during BR-005)
  ↓
Render cards in ListBox (Count length of filtered lists)
  ↓
User Dialog Click (Display filtered list in CustomDataTable)
```

---

## 9. Validation & Edge Cases

| Input State | Condition | Legacy Behavior | UI Impact |
|---|---|---|---|
| Null / Undefined Date | `Start_Date` or `Due_Date` is missing | `new Date(undefined)` returns `Invalid Date` | Excluded from calculations (yields `NaN`) |
| Empty String Date | Date string is `""` or `" "` | Handled by `length === 1` or `=== ""` check | Triggers empty date exception rules |
| Missing comments | `Last_Comment` is `""` or null | Excluded in `extractLatestCommentWithDate` | Not shown in comment breaches |
| No breaches found | All categories count is `0` | Option count badge displays `0` | ListBox row remains clickable |
| API Error / Timeout | Server returns non-200 or non-JSON | Logs console errors | Renders empty dashboard card |

---

## 10. Sorting & Grouping

- **Breach Cards Order**: Renders hardcoded layout boxes in this order:
  - **Breaches** (cardid 11)
  - **Due Dates** (cardid 12)
  - **CR Exceptions** (cardid 13)
- **Breach Options Order**: Fixed array push sequence in `CountsCard.js` (not alphabetically sorted or weighted).
- **Project Records Sort**: Rendered with `sortable={false}` inside `Project.js`. Renders in the raw order returned by the API array.

---

## 11. Conditional Rendering

### Table Columns by Card ID
Columns shown inside the detail popup table vary:
- If a category uses `ProjList` (Projects), the table renders project columns (`PMColumns`).
- If a category uses `CRList` (CRs), the table renders change request columns (`CRColumns`).
- Inside `PMColumns`, conditional columns based on `groupStatusCode === 3` or `groupStatusCode === 4` are **hidden** because `groupStatusCode` defaults to `0` for breach pages.

### Badge Colors
Option count badges inside the `ListBox` are color-coded statically with CSS `bg="success"` (green badge) regardless of the count value (as shown in the screenshot, even high counts like `92` or `40` remain green).

---

## 12. Complete UI Content Extraction

### Static Text Labels
- **Page Header**: `"Project Breaches"` (when SelectedPage is "breaches")
- **Last Updated Header**: `"Last updated: WO File: [date] | CR File: [date]"`
- **Breaches Card Header**: `"Breaches"`
- **Due Dates Card Header**: `"Due Dates"`
- **CR Exceptions Card Header**: `"CR Exceptions"`
- **No Data Box**: `"No Data Found in Project Breaches"`
- **Detail Modal Header**: `"Projects - [Breach Category Name]"`
- **Search Bar Placeholder**: `"Search"`

---

## 13. UI Data Mapping

| UI Element | Source API Field | Transformation | Condition | Final Display Value |
|---|---|---|---|---|
| Card Header Update Text | `wofile`, `crfile` | Formatted via date-fns | Checked if timestamps exist | `dd-MM-yyyy HH:mm:ss` |
| List Option Count Badge | array length | `.length` count | Counts size of filtered list | Numeric badge inside `<Badge bg="success">` |
| Details Project ID | `Wo_Id` | Read raw value | Default column body | Raw value or `true`/`false` (due to mutation bug) |
| Details Summary | `Summary` | String substring | Length > 30 chars | `Summary.substring(0, 30)...` + `[More]` link |
| Details Info Link | `Ipm_Number` | Custom body | Inside row body | Circular info icon + IPM Number text |

---

## 14. State Management

- **Stored Session**: `localStorage.getItem('SelectedPage')` caches the user's tab selection.
- **Data Flow**:
  1. Component mounts → triggers `loadProjectManagementData` in `ProjectBreaches.js`.
  2. API response sets `WOData` and `CRData` states.
  3. `WOData` and `CRData` passed down as props to `CountsCard`.
  4. `CountsCard` triggers `loadComponentData()` in `componentDidMount` / `componentDidUpdate`.
  5. Computes filtered arrays and updates `groupedList` local state.
  6. Click option → sets `selectedItem` and `showProjects: true` in local state.
  7. Opens `Project` detail dialog, passing the selected exception array down.

---

## 15. User Interactions

- **Switch Page Tab**: Clicking "Project Breaches" sets `SelectedPage` state to `"breaches"`.
- **Click Breach Category**: Clicking a listbox row sets `selectedItem` and displays the details table dialog.
- **Search Table**: Typing in the search input triggers `onGlobalFilterChange` to search columns locally.
- **Export Data**: Clicking the "Excel" icon triggers `ExportTableComponent` to download current table rows as a spreadsheet.
- **Close Modal**: Clicking the window close icon (`FaWindowClose`) resets dialog visibility state to `false`.

---

## 16. Constants & Configuration

The feature uses these hardcoded thresholds:
- `unClosedForDays` = `60` (BR-001)
- `testingForDays` = `15` (BR-002)
- `BRDSSDForDays` = `14` (BR-003)
- `unCommentedForDays` = `5` (BR-007)
- `emptyDev45Days` = `45` (BR-008)
- `varianceLimit` = `15` (BR-009)

---

## 17. Shared Dependencies

1. **PrimeReact Components**:
   - `ListBox` (`primereact/listbox`)
   - `Dialog` (`primereact/dialog`)
   - `DataTable` / `Column` (wrapped inside `CustomDataTable`)
2. **React Bootstrap**:
   - `Card`, `Badge`, `ToggleButton`, `ButtonGroup`
3. **Helper Util Functions**:
   - `getFileUpdatedata` / `getFilesUpdatedata` in `functions.js`.

---

## 18. Exact Execution Flow

1. User clicks the **Project Breaches** tab.
2. The tab component (`ProjectBreaches.js`) mounts.
3. `loadProjectManagementData` runs:
   - Dispatches GET to `/pm/importworkorderstatusfile`.
   - Dispatches POST to `/pm/getfile` with body `{ file_name: "wofile" }`.
4. API returns project records and timestamp details.
5. `WOData` array is mapped to add `StatusId` / `StatusGroup` properties.
6. Three `<CountsCard>` components render, passing the parsed records down.
7. Each `CountsCard` executes `loadComponentData()`:
   - Evaluates filter rules BR-001 through BR-013.
   - **Critical Side Effect**: While evaluating BR-005, the `WOData` records have their `Wo_Id` values overwritten with booleans.
   - Final filtered arrays are saved in `this.state.groupedList`.
8. UI renders the option names and their corresponding array lengths in badges.
9. User clicks a category, opening the detail modal (`Project.js`).
10. If the user clicks the info icon of a Change Request row, the dialog tries to fetch the parent project, triggering a crash (TypeError) due to the boolean ID mutation.

---

## 19. Machine-Readable Business Logic Specification

```text
PROJECT_BREACHES_SPECIFICATION

SOURCE:
Old/Legacy Application

FEATURE:
Project Monitoring → Project Breaches

API:
- GET /pm/importworkorderstatusfile
- GET /pm/getallfiles
- POST /pm/getfile (Body: { file_name: "wofile" })

REQUEST:
- Headers: Authorization: Bearer <Token>
- Query Params: None

RESPONSE SCHEMA:
{
  isSuccess: boolean,
  result1: Array<WorkOrder>,
  result2: Array<ChangeRequest>
}

FIELDS_MAPPING:
WorkOrder: {
  Wo_Id: int,
  Ipm_Number: string,
  Summary: string,
  Status: string,
  Start_Date: date,
  Due_Date: date,
  Planned_DEV_completion_Date: date,
  SIT_Received_date: date,
  UAT_Actual_End_Date: date,
  Last_Comment: string
}
ChangeRequest: {
  Wo_Id: int,
  Ipm_Number: string,
  Summary: string,
  Status: string,
  Start_Date: date,
  End_Date: date,
  Effort_in_MDs: string
}

BUSINESS_RULES:
- RULE_01 (Unclosed Projects): Start_Date older than 60 days AND StatusId != 16 AND StatusId != 17 AND Status != "Deferred"
- RULE_02 (Testing duration): SIT_Received_date older than 15 days AND StatusId >= 8 AND StatusId <= 12
- RULE_03 (BRD/SSD duration): Start_Date older than 14 days AND StatusId == 2 AND StatusId == 3 [BUG: Returns Empty]
- RULE_04 (Passed CR Due Date): End_Date in past AND CR.Status == "Open" AND CR.Status == "Development In Progress" [BUG: Returns Empty]
- RULE_05 (CR Progress vs WO Testing): CR.Status in ("Open", "Development In Progress") AND WO.StatusId >= 7 [BUG: Mutates WO.Wo_Id to boolean, Returns Empty]
- RULE_06 (CR Open vs WO Dev): CR.Status == "Open" AND WO.StatusId >= 5 [BUG: Due to RULE_05 mutation, Returns Empty]
- RULE_07 (No Comments): Latest comment date extracted from Last_Comment is older than 5 days AND Status != "Closed" AND Last_Comment != ""
- RULE_08 (Empty Planned Dev Date): Planned_DEV_completion_Date is empty AND Due_Date within next 45 days
- RULE_09 (Due Date vs Dev Completion): Abs(Due_Date - Planned_DEV_completion_Date) < 15 days
- RULE_10 (CR End > WO Due): CR.End_Date > WO.Due_Date [BUG: String comparison; also fails due to RULE_05 mutation]
- RULE_11 (No CR Man Days): Effort_in_MDs == "" OR Effort_in_MDs == 0
- RULE_12 (No CR Start Date): CR.Start_Date == "" OR length == 1
- RULE_13 (No CR End Date): CR.End_Date == "" OR length == 1

MUTATION_BUG_WARNING:
Evaluating counts in cardid 11 mutates shared WOData[].Wo_Id to boolean, breaking all subsequent ID joins.
```

---

## 20. Source Code Evidence

### Evidence 1: In-Place Data Mutation Bug
- **File**: `CountsCard.js`
- **Lines**: 632–643
- **Code**:
  ```javascript
        CRProgess.forEach(function (x) {
          let projectStatusId = mySelf.props.data.filter((obj) => {
            return (obj.Wo_Id = x.Wo_Id && obj.StatusId >= 7);
          });
  
          mySelf.props.data.filter((obj) => {
            if (x.Wo_Id === obj.Wo_Id) {
              if (obj.StatusId >= 7) {
                CRProgessResult.push(x);
              }
            }
          });
        });
  ```
- **Explanation**: Line `obj.Wo_Id = x.Wo_Id && obj.StatusId >= 7` mutates the original project array's `Wo_Id` values, transforming them into booleans. This corrupts subsequent checks and causes TypeErrors inside detail dialog popups when clicking on info icons.

### Evidence 2: Logical Contradictions
- **File**: `CountsCard.js`
- **Lines**: 244-245 & 613-620
- **Code**:
  ```javascript
          return (
            diffDays > BRDSSDForDays && obj.StatusId === 2 && obj.StatusId === 3
          );
  ```
  and
  ```javascript
          return (
            CRdueDate < today &&
            obj.Status === "Open" &&
            obj.Status === "Development In Progress"
          );
  ```
- **Explanation**: A field can never equal two distinct values concurrently. Therefore, these conditions can never be met, resulting in static zero counts.
