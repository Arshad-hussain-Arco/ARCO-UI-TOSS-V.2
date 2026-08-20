# PROJECT MONITORING — PARITY REPORT

## 1. Legacy Source
* **Specification Document**: [PROJECT_MONITORING_REQUIREMENTS.md](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/PROJECT_MONITORING_REQUIREMENTS.md)
* **Authoritative Reference**: Legacy application implementation (ARCO-RE-UI-TOSS) and backend API contracts.

---

## 2. NEW Implementation Files Changed / Created

| File | Action | Purpose / Description |
| --- | --- | --- |
| [staticData.js](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/utils/staticData.js) | **[NEW]** | Authoritative single source of truth for 7 Status Groups (`PMStatusGroups`) and 17 SDLC Status Stages (`PMStatus`). |
| [dataMapper.js](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/utils/dataMapper.js) | **[MODIFY]** | Complete overhaul of field mapping, `Wo_Id` parsing, `myFunc` role reduction engine (Cards 1-7), upcoming completions (Cards 8-10), breach calculation matrix (Cards 11-13), grid multi-criteria search filter, and completed trends aggregations. |
| [statusMapper.js](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/utils/statusMapper.js) | **[MODIFY]** | Updated to use exact 17 SDLC stages and 7 Status Groups for progress bar rendering and dropdown options. |
| [ProjectInfo1Modal.jsx](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/components/ProjectInfo1Modal.jsx) | **[NEW]** | Single project detail dialog containing Left/Right metadata tables, timeline status percentage, overdue alert calculation, SVG circular progress bar (`StatusBar`), and phase duration breakdown. |
| [ProjectExecutiveModal.jsx](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/components/ProjectExecutiveModal.jsx) | **[NEW]** | Interactive drill-down details table modal supporting instant search and Excel (`xlsx`) spreadsheet export. |
| [ProjectBreaches.jsx](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/components/ProjectBreaches.jsx) | **[NEW]** | Dedicated container view for the Project Breaches tab rendering Card 11 (Breaches), Card 12 (Due Dates), and Card 13 (CR Exceptions). |
| [projectService.js](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/services/projectService.js) | **[MODIFY]** | Added `getFileUpdates` API integration for file update timestamp headers. |
| [ProjectMonitoringPage.jsx](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/ProjectMonitoringPage.jsx) | **[MODIFY]** | Main container refactored with tab switching, header timestamp, dynamic Project Type radios, 7 status group cards + 2 exception cards with bar chart toggle, 6 multi-criteria search filters, frozen column project grid with 30-char description truncation modal, 10 count cards, and 4 trends tab charts. |

---

## 3. Removed Incorrect Logic
1. **Removed Static Mock Fallback Data**: Completely removed `SAMPLE_PROJECTS` mock dataset and artificial overdue/chart fallbacks.
2. **Removed Fuzzy Lifecycle Stage Matching**: Replaced imprecise string substring searches with strict `StatusId` (1–17) and `StatusGroup` (1–7) mapping from `staticData.js`.
3. **Removed Conflicting Role Categorization**: Replaced non-standard role grouping logic with exact legacy `myFunc` reduction logic for ITDL, PO, Backup ITDL, SIT Lead, UAT Lead, Assigned Developer, and Additional Developers.
4. **Removed Divergent Breach Calculations**: Replaced custom SLA rules with authoritative calculation logic matching Section 17 & 18 of `PROJECT_MONITORING_REQUIREMENTS.md`.

---

## 4. Legacy Logic Implemented

### Data Mapping & Transformation
- **`Wo_Id` Integer Parsing**: `Wo_Id` is parsed as integer via `parseInt(wo.Wo_Id, 10)` to ensure exact cross-referencing with Change Requests (`cr.Wo_Id === wo.Wo_Id`).
- **Status Mapping**: Matches status strings case-insensitively against `PMStatus` dictionary to attach `StatusId` (1..17) and `StatusGroup` (1..7).
- **Project Type (`Depends_On`)**: If `Depends_On` is empty or has length <= 1, it is mapped to `"Not Available"`.

### Team & Milestone Metrics (Cards 1–10)
- **Cards 1–5**: Groups Work Orders (`result1`) by `IT_Delivery_Lead`, `Product_Owner`, `Backup_IT_Delivery_Lead`, `SIT_Lead`, and `UAT_Lead`.
- **Cards 6–7**: Groups Change Requests (`result2`) by `Assigned_Developer` and `Additional_Developers` (split by `,` or `/`).
- **Cards 8–10**: Buckets upcoming completions in 15, 30, 45, and 60 day windows where `today <= date <= today + N days`.
  - Card 8: CR Dev Completion (`CR.End_Date`)
  - Card 9: WO Testing Completion (`WO.Due_Date`)
  - Card 10: WO Delivery Completion (`WO.UAT_Actual_End_Date`)

### Project Breaches Engine (Cards 11–13)
- **Card 11 (Breaches - 7 metrics)**:
  1. Unclosed Projects Started Before 60 Days: `(today - Start_Date) > 60 days && StatusId !== 16 && StatusId !== 17 && Status !== 'Deferred'`
  2. Project in Testing for > 15 Days: `(today - SIT_Received_date) > 15 days && StatusId >= 8 && StatusId <= 12`
  3. Project in BRD/SSD Stage for > 14 Days: `(today - Start_Date) > 14 days && (StatusId === 2 || StatusId === 3)`
  4. Passed CR Due Dates: `CR.End_Date < today && (CR.Status === 'Open' || CR.Status === 'Development In Progress')`
  5. CR In Progress but WO moved to Testing: `(CR.Status === 'Open' || CR.Status === 'Development In Progress') && WO.StatusId >= 7`
  6. CR Open but WO moved to Development: `CR.Status === 'Open' && WO.StatusId >= 5`
  7. Projects with No Comments > 5 Days: Latest comment date extracted via regex `([A-Z][a-z]{2} \d{1,2}, \d{4})` with `(today - latestDate) > 5 days && Status !== 'Closed'`
- **Card 12 (Due Dates - 2 metrics)**:
  1. Empty Planned Dev Completion in Next 45 Days: `(!Planned_DEV_completion_Date || length <= 1) && Due_Date >= today && Due_Date <= today + 45 days`
  2. Due Date - Dev Completion < 2 Weeks: `Planned_DEV_completion_Date && Due_Date && (Due_Date - Planned_DEV_completion_Date) < 15 days`
- **Card 13 (CR Exceptions - 4 metrics)**:
  1. CR Due Date > WO Due Date: `cr.Wo_Id === wo.Wo_Id && cr.End_Date > wo.Due_Date`
  2. No Man Days in CR: `parseInt(Effort_in_MDs) === 0 || Effort_in_MDs === '' || !Effort_in_MDs`
  3. No Start in CR: `!Start_Date || Start_Date.length <= 1`
  4. No Due Date in CR: `!End_Date || End_Date.length <= 1`

### Timeline & Single Project Details (`ProjectInfo1`)
- **Status Percentage & Overdue Days**:
  - `Status === "Completed"` -> `100%`, color `#83AF9B`.
  - Overdue when `(today - Start_Date) > (Due_Date - Start_Date)` -> Percentage displays `-`, Progress Bar color `#E8175D`, Overdue days = `(today - Start_Date) - TotalExpectedDuration`.
  - SVG Circular Progress Bar (`StatusBar`) renders animated stroke offset.
  - Phase Duration Breakdown: Planning, Development, Testing, and Total Delivered days.

---

## 5. API Parity

| Parameter | Legacy Behavior | NEW Implementation | Status |
| --- | --- | --- | --- |
| **Endpoint** | GET `/importworkorderstatusfile` | GET `/capacity-planning/work-order-status/` (or `/importworkorderstatusfile`) | **MATCHING** |
| **Response Key 1** | `result1` (Work Orders) | Handled `result1` or `workOrders` | **MATCHING** |
| **Response Key 2** | `result2` (Change Requests) | Handled `result2` or `changeRequests` | **MATCHING** |
| **Timestamp API** | GET `/getallfilesupdate` | GET `/getallfilesupdate` | **MATCHING** |

---

## 6. Validation Parity
- Verified `Wo_Id` parsing using `parseInt()`.
- Date range boundary formatting uses `YYYY-MM-DD` (`en-CA`) for exact ISO string comparison.
- Comment staleness regex parsing matches `([A-Z][a-z]{2} \d{1,2}, \d{4})`.

---

## 7. Calculation & Count Parity
- **Status Group Counts (Cards 1-7)**: Calculated directly from dataset filtering by `StatusGroup`.
- **Team Role Grouping (Cards 1-7)**: Standardized `myFunc` reduction formula matching legacy counts.
- **Milestone Buckets (Cards 8-10)**: Calculated strictly using `today <= targetDate <= today + N days`.
- **Breach Counts (Cards 11-13)**: Calculated strictly using the 13 legacy breach conditions.

---

## 8. UI Parity & Design System Integration
- Combined NEW application's modern dark theme, clean typography, and responsive grid layout with proven legacy functionality.
- Re-added missing UI elements:
  - Tab Switcher button group for "Project Monitoring" and "Project Breaches".
  - Header timestamp line for WO and CR file updates.
  - Project Type Radio button group.
  - Bar Chart toggle mode for status group cards.
  - Frozen left column with green info icon opening `ProjectInfo1Modal`.
  - 30-char description truncation modal button ("More").
  - Completed Projects Trends TabView (Monthly, Quarterly, Half-Yearly, Annual).
  - Excel (`xlsx`) spreadsheet export in drill-down modals.

---

## 9. Remaining Differences
* None. All legacy functional rules, calculations, validations, data mappings, status maps, breach logic, and UI elements specified in [PROJECT_MONITORING_REQUIREMENTS.md](file:///c:/git/TOSS%20v2/ARCO-UI-TOSS-V.2/src/pages/ProjectMonitoring/PROJECT_MONITORING_REQUIREMENTS.md) have been implemented.
