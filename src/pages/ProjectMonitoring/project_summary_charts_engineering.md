# Project Summary Charts — Legacy Engineering Specification

This document details the reverse-engineered logic of the **Chart** and **Project Timeline** components from the legacy application's Project Summary view (`ProjectInfo1.js` and `StatusBar.js`).

---

## 1. Components Overview

1. **Chart Component**: A bar chart displaying project life cycle stage durations in calendar days.
2. **Project Timeline Component**: A circular progress indicator (`StatusBar.js`) showing completion percentage or overdue status.

---

## 2. Source Files

1. **[ProjectInfo1.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js)**
   - **Purpose**: Main project detail popup component.
   - **Role**: Calculates phase durations for the bar chart and computes total expected vs elapsed project days to determine status percentage, overdue days, and color codes.
2. **[StatusBar.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/StatusBar.js)**
   - **Purpose**: Custom SVG progress ring indicator.
   - **Role**: Calculates SVG `strokeDasharray` and `strokeDashoffset` to render the circular percentage ring and center percentage text.
3. **[ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js)**
   - **Role**: Parent component instantiating `ProjectInfo1` with `DataShow` (WO record) and `crData` (filtered CR array).
4. **[ProjectExecutive.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectExecutive.js)**
   - **Role**: Alternative parent component instantiating `ProjectInfo1`.
5. **[Project.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Project.js)**
   - **Role**: Breach details popup component instantiating `ProjectInfo1`.

---

## 3. API & Data Inputs

- **Endpoint**: `GET /pm/importworkorderstatusfile`
- **Data Collections**:
  - `result1` (Work Orders): Supplies `DataShow` containing `Start_Date`, `Due_Date`, `SIT_Received_date`, `UAT_Actual_End_Date`, and `Status`.
  - `result2` (Change Requests): Supplies `crData` containing `Wo_Id`, `Start_Date`, and `End_Date`. Filtered via `crData.filter(cr => cr.Wo_Id === DataShow.Wo_Id)`.

---

## 4. Chart Data Flow

```text
API Response (result1 & result2)
      ↓
Parent Component filters crData for current Wo_Id
      ↓
Props passed to ProjectInfo1 (DataShow & crData)
      ↓
componentDidMount() executes
      ↓
findMinMax(crData) extracts earliest CR Start_Date & latest CR End_Date
      ↓
Calculates phase durations in calendar days (Planning, Development, Testing, Delivered)
      ↓
Populates basicData state object
      ↓
<Chart type="bar" id="bar-chart" data={this.state.basicData} />
```

---

## 5. Chart Field Mapping

| Chart Bar Label | Source API Fields | Transformation / Formula | Final Value Unit |
|---|---|---|---|
| **Planning** | `crData[].Start_Date`, `DataShow.Start_Date` | `(min(crData.Start_Date) - DataShow.Start_Date) / 86400000` | Calendar Days |
| **Development** | `crData[].Start_Date`, `crData[].End_Date` | `(max(crData.End_Date) - min(crData.Start_Date)) / 86400000` | Calendar Days |
| **Testing** | `DataShow.SIT_Received_date`, `DataShow.UAT_Actual_End_Date` | `(DataShow.UAT_Actual_End_Date - DataShow.SIT_Received_date) / 86400000` | Calendar Days |
| **Delivered** | `DataShow.Start_Date`, `DataShow.Due_Date` | `(DataShow.Due_Date - DataShow.Start_Date) / 86400000` | Calendar Days |

---

## 6. Chart Calculations

### Helper Function: `findMinMax(arr)`
```javascript
findMinMax(arr) {
  if (arr.length === 0) return undefined;
  let minDate = arr[0];
  let maxDate = arr[0];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i].Start_Date < minDate.Start_Date) minDate = arr[i];
    if (arr[i].End_Date > maxDate.End_Date) maxDate = arr[i];
  }
  return { min: minDate.Start_Date, max: maxDate.End_Date };
}
```

### Exact Formulas

#### 1. Planning Duration
- **Formula**: `Planning = (new Date(minCRDesignStartDate) - new Date(WOStartDate)) / (1000 * 60 * 60 * 24)`
- **Output**: Number of calendar days between WO start date and minimum CR start date.

#### 2. Development Duration
- **Formula**: `Development = (new Date(maxCRDevEndDate) - new Date(minCRDevStartDate)) / (1000 * 60 * 60 * 24)`
- **Output**: Total calendar day span across all CRs.

#### 3. Testing Duration
- **Formula**: `Testing = (new Date(UAT_Actual_End_Date) - new Date(SIT_Received_date)) / (1000 * 60 * 60 * 24)`
- **Output**: Number of calendar days between SIT reception date and UAT actual end date.

#### 4. Delivered (Total WO Duration)
- **Formula**: `Deliver = (new Date(Due_Date) - new Date(Start_Date)) / (1000 * 60 * 60 * 24)`
- **Output**: Overall planned WO duration in calendar days.

---

## 7. Chart Business Rules

1. **Units**: Values represent **raw calendar days**, not percentages, task counts, or mandays.
2. **Fixed Bar Order**: Always renders 4 bars in fixed order: `["Planning", "Development", "Testing", "Delivered"]`.
3. **No Rounding**: Durations are floating-point numbers resulting from millisecond division.
4. **Dependency on CRs**: If `crData` is empty (`[]`), `findMinMax` returns `undefined`, skipping `setState` for `basicData`.

---

## 8. Chart Edge Cases

| Scenario | Code Behavior | Final UI Result |
|---|---|---|
| `crData` is empty (`[]`) | `findMinMax` returns `undefined` | Renders un-updated initial mock dataset (`data: [40, 35, 45]`) |
| `SIT_Received_date` or `UAT_Actual_End_Date` missing | `new Date(undefined)` returns `Invalid Date` | Testing bar value becomes `NaN` |
| End date earlier than start date | Subtraction yields negative milliseconds | Bar renders with a negative value |

---

## 9. Chart Rendering Configuration

- **Library**: PrimeReact Chart (`primereact/chart`) / Chart.js
- **Chart Type**: `"bar"`
- **Element ID**: `bar-chart`
- **Colors**:
  - `Planning`: `#42A5F5` (Dodger Blue)
  - `Development`: `"red"` (`#FF0000`)
  - `Testing`: `#EC407A` (Pink/Magenta)
  - `Delivered`: `#66BB6A` (Green)
- **Data Structure**:
  ```javascript
  {
    labels: ["Planning", "Development", "Testing", "Delivered"],
    datasets: [
      {
        backgroundColor: ["#42A5F5", "red", "#EC407A", "#66BB6A"],
        data: [Planning, Devlopment, Testing, Deliver]
      }
    ]
  }
  ```

---

## 10. Project Timeline Data Flow

```text
API Response (DataShow: Start_Date, Due_Date, Status)
      ↓
ProjectInfo1.componentDidMount()
      ↓
Evaluates TotalExpectedDuration & TotalCompletedDays
      ↓
Calculates StatusPercentage = Math.round((TotalCompletedDays * 100) / TotalExpectedDuration)
      ↓
Checks if Status === "Completed" or StatusPercentage > 100
      ↓
Updates State (projectStatusText, projectStatusPercentage, progressBarColorCode)
      ↓
Passes props to <StatusBar sqSize="250" strokeWidth="10" ... />
      ↓
StatusBar calculates SVG circle radius, dashArray, and dashOffset
      ↓
Renders SVG Circle Progress Ring + Text & Status Text below ring
```

---

## 11. Timeline Percentage & Overdue Formulas

### Inputs
- `WOStartDate = new Date(DataShow.Start_Date)`
- `WOEndDate = new Date(DataShow.Due_Date)`
- `currentDate = new Date()` (Current client system date/time)

### Intermediate Calculations
- `TotalExpectedDuration = (WOEndDate - WOStartDate) / (1000 * 60 * 60 * 24)`
- `TotalCompletedDays = (currentDate - WOStartDate) / (1000 * 60 * 60 * 24)`
- `StatusPercentage = Math.round((TotalCompletedDays * 100) / TotalExpectedDuration)`

### Conditional Evaluation Logic

#### Branch A: `DataShow.Status === "Completed"`
- `projectStatusText` = `"Completed"`
- `projectStatusPercentage` = `100` (Number)
- `progressBarColorCode` = `"#83AF9B"` (Sage Green)

#### Branch B: Not Completed & `StatusPercentage <= 100` (On-Time / In-Progress)
- `projectStatusText` = `DataShow.Status` (raw API string)
- `projectStatusPercentage` = `StatusPercentage` (rounded integer, e.g. `85`)
- `progressBarColorCode` = `"#2F9599"` (Teal)

#### Branch C: Not Completed & `StatusPercentage > 100` (Overdue)
- `overdueDays = Math.round(TotalCompletedDays - TotalExpectedDuration)`
- `projectStatusText` = `DataShow.Status.concat(" ( Over Due for - ", overdueDays, " Days)")`
- `projectStatusPercentage` = `"-"` (String hyphen)
- `progressBarColorCode` = `"#E8175D"` (Crimson Red)

---

## 12. Date Logic

- **Current Date**: Evaluated dynamically using JavaScript `new Date()`.
- **Date Difference**: `(Date2 - Date1) / (1000 * 60 * 60 * 24)` yields calendar days.
- **Rounding**: Uses `Math.round()` for status percentages and overdue days.

---

## 13. Status Logic

- `DataShow.Status` is retrieved directly from the API response (`result1[].Status`).
- If overdue, status text is appended dynamically with `" ( Over Due for - [X] Days)"`.

---

## 14. Overdue Logic

- **Threshold**: Triggered whenever `StatusPercentage > 100`.
- **Overdue Days Formula**: `Math.round(TotalCompletedDays - TotalExpectedDuration)`
- **Percentage Display when Overdue**: Replaced with string `"-"`, rendering `-%` inside the circle.
- **Color when Overdue**: Switches to `#E8175D`.

---

## 15. Timeline Edge Cases

| Scenario | Code Behavior | Final UI Result |
|---|---|---|
| `Start_Date` or `Due_Date` missing | `new Date(undefined)` returns `Invalid Date` | Durations evaluate to `NaN`; circle displays `NaN%` |
| `Start_Date === Due_Date` | `TotalExpectedDuration` is `0` | `StatusPercentage` evaluates to `Infinity` (> 100); displays overdue format |
| Overdue Project | `projectStatusPercentage` is set to `"-"` | SVG `dashOffset` evaluates to `NaN`; circle displays `-%` |

---

## 16. Exact Text Extraction

- **Chart Title**: `"Chart"`
- **Project Timeline Title**: `"Project Timeline"`
- **Status Label Format**: `"Status - " + projectStatusText`
- **Overdue String Format**: `" [Status] ( Over Due for - [X] Days)"` (Note exact spaces and capitalization)

---

## 17. Business Logic vs Visual Logic

### BUSINESS LOGIC (Must Preserve Exactly)
1. **Chart Bars**: Represent calendar day phase durations between dates (`Planning`, `Development`, `Testing`, `Delivered`).
2. **Timeline Percentage**: `Math.round((TotalCompletedDays * 100) / TotalExpectedDuration)`.
3. **Overdue Days**: `Math.round(TotalCompletedDays - TotalExpectedDuration)`.
4. **Overdue Trigger**: `StatusPercentage > 100`.
5. **Overdue Fallback Symbol**: Displays `-%` instead of numeric percentage when overdue.

### VISUAL LOGIC (To Redesign in New App)
1. Chart colors (`#42A5F5`, `red`, `#EC407A`, `#66BB6A`).
2. SVG circle sizes (`sqSize="250"`, `strokeWidth="10"`).
3. Status text color coding (`#83AF9B`, `#2F9599`, `#E8175D`).
4. PrimeReact chart container layout.

---

## 18. New Application Implementation Instructions

When implementing in the new application:
1. **Preserve exact formulas** for phase durations, status percentage, and overdue days.
2. **Preserve overdue text string formatting**: `"[Status] ( Over Due for - [X] Days)"`.
3. **Preserve `-%` fallback** when overdue or percentage calculation is invalid.
4. **Redesign the UI** using the new application's design system (modern charts, responsive SVG ring, accessible typography).

---

## 19. Source Code Evidence

### Evidence 1: Chart Phase Calculation
- **File**: `ProjectInfo1.js`
- **Lines**: 398–434
- **Code**:
  ```javascript
      let minCRDesignStartDate = new Date(CRDev.min);
      let Planning = (minCRDesignStartDate - WOStartDate) / (1000 * 60 * 60 * 24);
      let minCRDevStartDate = new Date(CRDev.min);
      let maxCRDevEndDate = new Date(CRDev.max);
      let Devlopment = (maxCRDevEndDate - minCRDevStartDate) / (1000 * 60 * 60 * 24);
      let WOSITRecivedTestingStartDate = new Date(this.props.DataShow.SIT_Received_date);
      let WOUATActucalEndDate = new Date(this.props.DataShow.UAT_Actual_End_Date);
      let Testing = (WOUATActucalEndDate - WOSITRecivedTestingStartDate) / (1000 * 60 * 60 * 24);
      let Deliver = (WOEndDate - WOStartDate) / (1000 * 60 * 60 * 24);

      dataset.push(Planning, Devlopment, Testing, Deliver);
  ```

### Evidence 2: Timeline Overdue Calculation & Status Text
- **File**: `ProjectInfo1.js`
- **Lines**: 445–471
- **Code**:
  ```javascript
      let TotalExpectedDuration = (WOEndDate - WOStartDate) / (1000 * 60 * 60 * 24);
      let TotalCompletedDays = (currentDate - WOStartDate) / (1000 * 60 * 60 * 24);
      let StatusPercentage = Math.round((TotalCompletedDays * 100) / TotalExpectedDuration);

      if (StatusPercentage > 100) {
        this.setState({
          projectStatusText: this.props.DataShow.Status.concat(
            " ( Over Due for - ",
            Math.round(TotalCompletedDays - TotalExpectedDuration),
            " Days)"
          ),
          projectStatusPercentage: "-",
          progressBarColorCode: "#E8175D",
        });
      } else {
        this.setState({
          projectStatusText: this.props.DataShow.Status,
          projectStatusPercentage: StatusPercentage,
          progressBarColorCode: "#2F9599",
        });
      }
  ```

### Evidence 3: SVG Stroke Math
- **File**: `StatusBar.js`
- **Lines**: 15–21 & 48–56
- **Code**:
  ```javascript
    const radius = (this.props.sqSize - this.props.strokeWidth) / 2;
    const dashArray = radius * Math.PI * 2;
    const dashOffset = dashArray - dashArray * this.props.percentage / 100;
    ...
    {`${this.props.percentage}%`}
  ```

---

## 20. End-to-End Execution Flow

1. User opens a single project summary view in `ProjectManagement`, `ProjectExecutive`, or `Project`.
2. Parent passes `DataShow` (WO record) and `crData` (filtered CRs) to `<ProjectInfo1 />`.
3. `ProjectInfo1.componentDidMount()` runs:
   - Reads `Start_Date`, `Due_Date`, `SIT_Received_date`, `UAT_Actual_End_Date` from `DataShow`.
   - Calls `findMinMax(crData)` to extract earliest CR start date and latest CR end date.
   - Computes `Planning`, `Development`, `Testing`, `Deliver` stage durations in calendar days.
   - Updates `basicData` state, rendering the PrimeReact bar chart.
   - Computes `TotalExpectedDuration`, `TotalCompletedDays`, and `StatusPercentage`.
   - If `Status === "Completed"`, percentage is set to `100`.
   - If `StatusPercentage > 100`, status text is formatted with `" ( Over Due for - [X] Days)"`, percentage is set to `"-"`, and color is set to `#E8175D`.
   - Otherwise, percentage is set to `StatusPercentage` and color to `#2F9599`.
4. Renders `<StatusBar percentage={this.state.projectStatusPercentage} ... />`.
5. `StatusBar` calculates SVG circle offset and renders the `-%` or `X%` progress ring and text label below it.
