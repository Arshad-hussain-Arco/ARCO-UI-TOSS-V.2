# Completed Projects Trends — Legacy Engineering Specification

This document details the reverse-engineered logic of the **Completed Projects Trends** chart feature from the legacy application (`ProjectManagement.js`, `MonthlyPMData.js`, `QuarterlyPMData.js`, `HalfYearlyPMData.js`, and `AnnualPMData.js`).

---

## 1. Components & File Map

The Completed Projects Trends feature comprises the following files:

### Component Hierarchy & Tab Structure
```text
ProjectManagement.js (Parent Container)
  └─ Completed Projects Trends Card
       └─ PrimeReact TabView
            ├─ Tab 1: Monthly (Inline buildChartData / MonthlyPMData.js)
            ├─ Tab 2: Quarterly (QuarterlyPMData.js)
            ├─ Tab 3: Half Yearly (HalfYearlyPMData.js)
            └─ Tab 4: Annually (AnnualPMData.js)
```

### Relevant Files & Roles
1. **[ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js)**
   - **Purpose**: Main parent component for Project Monitoring.
   - **Role**: Contains `buildChartData(res)` method that calculates monthly completed project counts, manages `monthlyChartData` state, and renders the 4-tab trend view (`Monthly`, `Quarterly`, `Half Yearly`, `Annually`).
2. **[MonthlyPMData.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/MonthlyPMData.js)**
   - **Purpose**: Standalone monthly trend chart component.
   - **Role**: Groups projects by 0-indexed month of `Due_Date` into 12 calendar month buckets.
3. **[QuarterlyPMData.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/QuarterlyPMData.js)**
   - **Purpose**: Quarterly trend chart component.
   - **Role**: Groups projects by quarter (`Q1`, `Q2`, `Q3`, `Q4`) using string matching on the month portion of `Due_Date`.
4. **[HalfYearlyPMData.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/HalfYearlyPMData.js)**
   - **Purpose**: Half-yearly trend chart component.
   - **Role**: Groups projects into `Jan - Jun` (months 1–6) and `Jul - Dec` (months 7–12) using `Due_Date`.
5. **[AnnualPMData.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/AnnualPMData.js)**
   - **Purpose**: Annual trend chart component.
   - **Role**: Groups projects into 3 rolling year buckets (`CurrentYear - 2`, `CurrentYear - 1`, `CurrentYear`) using the year of `Due_Date`.

---

## 2. API Specifications

- **Endpoint**: `${AppConfig.api.url}/pm/importworkorderstatusfile`
- **Method**: `GET`
- **Service Function**: `OSSSystem.services.projectManagementService.getProjectManagementData(afterResponse)`
- **Request Parameters / Body**: None.
- **Data Collections**: Uses `result1` (Work Orders / Projects).
- **Backend vs Frontend Filtering**: Data is retrieved completely in a single GET request; all filtering, status identification, date parsing, and period aggregation occur on the **frontend**.

---

## 3. Data Flow Architecture

```text
API Response (GET /pm/importworkorderstatusfile)
      ↓
result1 (Work Orders Array)
      ↓
Frontend Filters (Optional project type filter e.g. "All Projects" or Depends_On)
      ↓
buildChartData() / Component componentDidMount()
      ↓
Status Check (project?.Status?.toLowerCase() === "completed")
      ↓
Date Parsing (new Date(project.Due_Date))
      ↓
Period Bucket Aggregation (Month / Quarter / Half-Year / Year)
      ↓
Dataset Construction (Labels & Numeric Count Arrays)
      ↓
PrimeReact <Chart type="bar" data={chartData} />
```

---

## 4. Completed Project Classification Logic

### RULE ID: CPT-001 — Completed Project Classification
- **Condition**: A project is classified as completed if its `Status` field equals `"Completed"` (case-insensitive comparison).
- **API Field**: `project.Status`
- **Accepted Value**: `"completed"` (after `.toLowerCase()`)
- **Excluded Statuses**: All other statuses (`"Deployed"`, `"In Development"`, `"BRD Analysis"`, `"FAT Testing"`, `"Deferred"`, etc.) are ignored.
- **Completion Date Field**: `project.Due_Date` (The legacy application uses `Due_Date` as the completion date reference).

---

## 5. Trend Period Definitions & X-Axis Formats

### 1. Monthly Trend
- **X-Axis Labels**: `["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]`
- **Date Extraction**: `monthIndex = new Date(project.Due_Date).getMonth()` (0 = January, 11 = December).
- **Default Range**: Fixed 12 calendar months.

### 2. Quarterly Trend
- **X-Axis Labels**: `["Jan - Mar", "Apr - Jun", "Jul - Sep", "Aug - Dec"]` *(Note: The 4th quarter label in legacy code is typed as `"Aug - Dec"`)*
- **Quarter Mapping**:
  - `Q1` (Jan - Mar): Months `"01"`, `"02"`, `"03"`
  - `Q2` (Apr - Jun): Months `"04"`, `"05"`, `"06"`
  - `Q3` (Jul - Sep): Months `"07"`, `"08"`, `"09"`
  - `Q4` (Oct - Dec): Months `"10"`, `"11"`, `"12"`
- **Date Extraction**: `month = project.Due_Date.split("-")[1]`

### 3. Half-Yearly Trend
- **X-Axis Labels**: `["Jan - Jun", "Jul - Dec"]`
- **Period Mapping**:
  - `Jan-Jun`: Months 1 to 6 (`month >= 1 && month <= 6`)
  - `Jul-Dec`: Months 7 to 12 (`month >= 7 && month <= 12`)
- **Date Extraction**: `month = new Date(project.Due_Date).getMonth() + 1`

### 4. Annual Trend
- **X-Axis Labels**: `[CurrentYear - 2, CurrentYear - 1, CurrentYear]` (e.g. `[2024, 2025, 2026]`)
- **Period Mapping**: Dynamic 3-year rolling window based on current system year (`new Date().getFullYear()`).
- **Date Extraction**: `dueDateYear = new Date(project.Due_Date).getFullYear()`

---

## 6. Y-Axis & Calculation Logic

- **Y-Axis Meaning**: Absolute Count of Completed Projects.
- **Unit**: Whole integer count (`0, 1, 2, 3...`).
- **Calculation Type**: Frequency accumulation / histogram bucketing.
- **Initial Values**: All period buckets are initialized to `0`.
- **Accumulation Formula**:
  - For Monthly: `projectCountsByMonth[monthIndex]++`
  - For Quarterly: `quarterCounts[quarter]++`
  - For Half-Yearly: `periodCounts[period]++`
  - For Annually: `projectCountsByYear[dueDateYear]++`
- **Percentages / Rates**: No percentages, normalization, or rate calculations exist.

---

## 7. Date Logic

- **Date Field Used**: `project.Due_Date`
- **Date Format**: Standard ISO date string (e.g. `"2026-05-15T00:00:00.000Z"` or `"2026-05-15"`).
- **Timezone Handling**: Local system timezone evaluated via `new Date()`.
- **Invalid Date Handling**: If `Due_Date` is missing or invalid, `new Date()` yields `Invalid Date`, `.getMonth()` returns `NaN`, and the record is excluded from aggregation.

---

## 8. Filtering & Processing Sequence

```text
1. Fetch API response from /pm/importworkorderstatusfile
2. Map statuses to StatusId / StatusGroup
3. Apply Project Type filter (if selected in radio buttons)
4. Iterate over filtered project list
5. Check if project.Status.toLowerCase() === "completed"
6. Parse project.Due_Date
7. Increment corresponding period bucket count
8. Construct Chart dataset object
9. Render PrimeReact <Chart type="bar" ... />
```

---

## 9. Validations & Edge Cases

| Scenario | Code Behavior | Final UI Result |
|---|---|---|
| Empty API Response | `projects = []` | All period buckets remain `0` |
| No Completed Projects | No project passes `status === "completed"` | All bar values render as `0` |
| Missing `Due_Date` | `new Date(undefined)` returns `Invalid Date` | `monthIndex` is `NaN`; project skipped |
| Project outside 3-year annual window | `dueDateYear` not in `[CurrentYear-2, CurrentYear-1, CurrentYear]` | Excluded from annual chart array |
| Case variation in status (e.g. `"Completed"`, `"COMPLETED"`) | Normalized via `.toLowerCase()` | Properly recognized and counted |

---

## 10. Chart Rendering Configuration

- **Library**: `primereact/chart` (Chart.js wrapper)
- **Chart Type**: `"bar"`
- **Element ID**: `bar-chart`
- **Monthly Bar Colors**:
  - Jan: `#EC407A`
  - Feb: `#AB47BC`
  - Mar: `#42A5F5`
  - Apr: `#7E57C2`
  - May: `#66BB6A`
  - Jun: `#FFCA28`
  - Jul: `#26A69A`
  - Aug: `#2EE2E8`
  - Sep: `#EC407A`
  - Oct: `#AB47BC`
  - Nov: `#42A5F5`
  - Dec: `#7E57C2`
- **Quarterly Bar Colors**: `['#EC407A', '#AB47BC', '#42A5F5', '#7E57C2']`
- **Half-Yearly Bar Colors**: `['#EC407A', '#42A5F5', '#7E57C2', '#66BB6A']`
- **Annual Bar Colors**: `['#EC407A', '#7E57C2', '#66BB6A']`

---

## 11. Business Logic vs Visual Logic

### BUSINESS LOGIC (Preserve in New App)
1. **Completion Classifier**: `Status.toLowerCase() === "completed"`.
2. **Completion Date Reference**: `project.Due_Date`.
3. **Monthly Periods**: 12 calendar months (Jan–Dec).
4. **Quarterly Periods**: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec).
5. **Half-Yearly Periods**: H1 (Jan-Jun), H2 (Jul-Dec).
6. **Annual Periods**: 3-year rolling window (`[CurrentYear - 2, CurrentYear - 1, CurrentYear]`).
7. **Y-Axis Unit**: Count of projects completed in each period.

### VISUAL LOGIC (Redesign in New App)
1. Hardcoded bar color arrays.
2. PrimeReact `<TabView>` tab layout.
3. Chart.js legend and canvas styling.

---

## 12. Source Code Evidence

### Evidence 1: Monthly Completed Projects Aggregation
- **File**: `ProjectManagement.js`
- **Lines**: 1362–1390
- **Code**:
  ```javascript
    buildChartData(res) {
      let projects = res;

      const projectCountsByMonth = {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
        6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0,
      };

      projects.forEach((project) => {
        const status = project?.Status?.toLowerCase();
        const dueDate = new Date(project.Due_Date);
        const monthIndex = dueDate.getMonth();
        if (status === "completed") {
          projectCountsByMonth[monthIndex]++;
        }
      });
      const MonthlyArray = Object.values(projectCountsByMonth);
  ```

### Evidence 2: Quarterly Aggregation
- **File**: `QuarterlyPMData.js`
- **Lines**: 46–70
- **Code**:
  ```javascript
          const quarters = {
              "Q1": ["01", "02", "03"],
              "Q2": ["04", "05", "06"],
              "Q3": ["07", "08", "09"],
              "Q4": ["10", "11", "12"]
          };
          const quarterCounts = { "Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0 };

          for (const project of projects) {
              const dueDate = project.Due_Date;
              const month = dueDate.split("-")[1];

              for (const quarter in quarters) {
                  if (quarters[quarter].includes(month)) {
                      quarterCounts[quarter]++;
                      break;
                  }
              }
          }
  ```

### Evidence 3: Half-Yearly Aggregation
- **File**: `HalfYearlyPMData.js`
- **Lines**: 46–55
- **Code**:
  ```javascript
    const periodCounts = { "Jan-Jun": 0, "Jul-Dec": 0 };
    projects.forEach(project => {
      const dueDate = new Date(project.Due_Date);
      const month = dueDate.getMonth() + 1;
      const period = month >= 1 && month <= 6 ? "Jan-Jun" : "Jul-Dec";
      periodCounts[period]++;
    });
  ```

### Evidence 4: Annual Rolling 3-Year Aggregation
- **File**: `AnnualPMData.js`
- **Lines**: 45–80
- **Code**:
  ```javascript
          let CurrentYear = new Date().getFullYear();
          let YearArray = [CurrentYear - 2, CurrentYear - 1, CurrentYear];

          projects.forEach(project => {
              const dueDateYear = new Date(project.Due_Date).getFullYear();
              if (!projectCountsByYear[dueDateYear]) {
                  projectCountsByYear[dueDateYear] = 1;
              } else {
                  projectCountsByYear[dueDateYear]++;
              }
          });

          let data = {
              labels: YearArray,
              datasets: [{
                  data: [
                      projectCountsByYear[CurrentYear - 2] || 0,
                      projectCountsByYear[CurrentYear - 1] || 0,
                      projectCountsByYear[CurrentYear] || 0,
                  ]
              }]
          };
  ```

---

## 13. End-to-End Execution Flow

1. User opens **Project Monitoring** dashboard in `ProjectManagement.js`.
2. Data is loaded via `OSSSystem.services.projectManagementService.getProjectManagementData`.
3. `buildChartData(FullProjectList)` runs:
   - Evaluates each project where `Status.toLowerCase() === "completed"`.
   - Extracts `monthIndex` from `Due_Date`.
   - Accumulates monthly counts in `projectCountsByMonth`.
   - Sets `monthlyChartData` state.
4. User selects `Quarterly`, `Half Yearly`, or `Annually` tab in `TabView`.
5. Child component (`QuarterlyPMData`, `HalfYearlyPMData`, or `AnnualPMData`) mounts, receives `FilterProjectData`, parses `Due_Date`, groups by period, and renders the corresponding PrimeReact bar chart.
