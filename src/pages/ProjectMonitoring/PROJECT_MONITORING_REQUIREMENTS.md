# Project Monitoring & Project Breaches — Comprehensive Single Source of Truth Documentation

This document serves as the **single source of truth** for understanding, maintaining, validating, and auditing the **Project Monitoring** page (including both the **Project Monitoring** tab and the **Project Breaches** tab) in the ARCO-RE-UI-TOSS dashboard application.

---

## 1. Feature Inventory

| ID | Tab | UI Feature | Component | Data Source | Logic Exists? | API | Calculation | Validation | Documented |
|---|---|---|---|---|---|---|---|---|---|
| FT-01 | Shared | Tab Switcher | `ProjectManagement.js` | LocalState / LocalStorage | Yes | None | Switch `SelectedPage` (`project_mngt` / `breaches`) | Permission check (`hasPmDashAccess`, `hasBreachesAccess`) | Yes |
| FT-02 | Shared | Page Title & Timestamp Header | `ProjectManagement.js`, `ProjectBreaches.js` | API (`getFilesUpdatedata`, `getFileUpdatedata`) | Yes | `getAllfilesUpdate`, `getFileUpdate` | Format timestamp `dd-MM-yyyy HH:mm:ss` | Fallback to "Not Available" | Yes |
| FT-03 | Project Monitoring | Project Type Radio Selector | `ProjectManagement.js` | `projectData` state (`Depends_On`) | Yes | `importworkorderstatusfile` | Filter by `Depends_On === radio` | Default to "All Projects" | Yes |
| FT-04 | Project Monitoring | Status Group KPI Cards (Cards 1-7) | `ProjectManagement.js`, `PMCard.js` | `statusGroupsList` state | Yes | Derived from `importworkorderstatusfile` | Count projects by `StatusGroup === id` | Filtered list length | Yes |
| FT-05 | Project Monitoring | Status KPI Cards (Testing Blocked & Deferred) | `ProjectManagement.js`, `PMCard.js` | `FilterProjectData` state | Yes | Derived from `importworkorderstatusfile` | Count projects where `Status === 'Testing Blocked'` or `'Deferred'` | Exact status match | Yes |
| FT-06 | Project Monitoring | Chart Toggle Button (Bar vs Cards) | `ProjectManagement.js` | Local state `showChartIcon` | Yes | None | Toggle state `showChartIcon` | None | Yes |
| FT-07 | Project Monitoring | Status Group Bar Chart View | `ProjectManagement.js`, PrimeReact `Chart` | `statusGroupsList`, `FilterProjectData` | Yes | Derived | Counts per status group + Testing Blocked + Deferred | Array map | Yes |
| FT-08 | Project Monitoring | Project Search & Filter Panel | `ProjectManagement.js` | Local state (`selectedStatusSearch`, `IPM_number`, `ITDLSearch`, `ProductOwnerSearch`, `startDateSearch`, `endDateSearch`) | Yes | None (Client-side) | Multi-criteria filtering on `FilterProjectData` | Date range boundary validation | Yes |
| FT-09 | Project Monitoring | Status Display View Toggle | `ProjectManagement.js` | Local state `statusView` | Yes | None | Toggle between `ProjectStatusGroup` (7 groups) and `ProjectStatus` (17 stages) | None | Yes |
| FT-10 | Project Monitoring | Main Project DataTable | `ProjectManagement.js`, PrimeReact `DataTable` | `FilterProjectGridData` | Yes | Derived | Scrollable grid with frozen Project Name column | `StatusId > 0` | Yes |
| FT-11 | Project Monitoring | Project Summary "More" Overlay Dialog | `ProjectManagement.js`, PrimeReact `Dialog` | `rowData.Summary` | Yes | None | Truncates text > 30 chars, click triggers dialog | Length check `> 30` | Yes |
| FT-12 | Project Monitoring | Count BY Metrics Cards (Cards 1-10) | `ProjectManagement.js`, `CountsCard.js` | `FilterProjectData`, `FilteredCRData` | Yes | `importworkorderstatusfile` | Grouping by ITDL, PO, Backup ITDL, SIT Lead, UAT Lead, Developer, Additional Dev, Upcoming 15/30/45/60 days completion | Object `reduce` & Date delta checks | Yes |
| FT-13 | Project Monitoring | Completed Projects Trends Tabs | `ProjectManagement.js`, `QuarterlyPMData.js`, `HalfYearlyPMData.js`, `AnnualPMData.js` | `FilterProjectData` | Yes | Derived | Monthly, Quarterly, Half-Yearly, Annual aggregations of Completed projects | Date parsing & month/quarter/half/year buckets | Yes |
| FT-14 | Project Monitoring | Executive Status Group Drill-down | `ProjectManagement.js`, `ProjectExecutive.js` | `FilterProjectData`, `executiveData` | Yes | Derived | Filter projects matching clicked `StatusGroup` | Length check & badge display | Yes |
| FT-15 | Project Monitoring | Status Category Project Drill-down | `ProjectManagement.js`, `Project.js` | `FilterProjectData`, `otherStatusName` | Yes | Derived | Filter projects matching clicked status name | Status match | Yes |
| FT-16 | Project Monitoring | Single Project Detail Modal | `ProjectManagement.js`, `ProjectInfo1.js` | Selected `projectInfo`, `CRData` | Yes | Derived | Calculate lifecycle durations, timeline percentage, circular progress indicator | Date math: `(current - start)/(due - start)` | Yes |
| FT-17 | Project Breaches | Breaches Card (Card 11) | `ProjectBreaches.js`, `CountsCard.js` | `WOData`, `CRData` | Yes | `importworkorderstatusfile` | 7 breach categories: Unclosed > 60 days, Testing > 15 days, BRD/SSD > 14 days, Passed CR due dates, CR in progress WO testing, CR open WO dev, No comments > 5 days | Date math & status ID thresholds | Yes |
| FT-18 | Project Breaches | Due Dates Card (Card 12) | `ProjectBreaches.js`, `CountsCard.js` | `WOData` | Yes | Derived | 2 categories: Empty Planned Dev Date in 45 days, Due Date - Dev Completion < 2 Weeks | Date range checks | Yes |
| FT-19 | Project Breaches | CR Exceptions Card (Card 13) | `ProjectBreaches.js`, `CountsCard.js` | `WOData`, `CRData` | Yes | Derived | 4 categories: CR Due Date > WO Due Date, No Man Days in CR, No Start in CR, No Due Date in CR | Cross-record comparison & null string checks | Yes |
| FT-20 | Shared | Excel & PDF Export | `Project.js`, `ProjectExecutive.js`, `ExportTableComponent.js` | Table dataset props | Yes | None | Generates Excel via `XLSX` and PDF via `jsPDF-autotable` | Permission check `can_export` | Yes |

---

## 2. UI Element → Source Code Mapping

| UI Element | Exact Label / Role | Component / File | Function / Variable | API / Data Field | Business Logic | Validation | Calculation | Type |
|---|---|---|---|---|---|---|---|---|
| Tab Switcher Button 1 | "Project Monitoring" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L642) | `onSelectPage('project_mngt')` | N/A | Switches active view to Project Monitoring tab | Checks `hasPmDashAccess` permission | Sets `SelectedPage = 'project_mngt'`, `isProjects = true` | Dynamic |
| Tab Switcher Button 2 | "Project Breaches" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L642) | `onSelectPage('breaches')` | N/A | Switches active view to Project Breaches tab | Checks `hasBreachesAccess` permission | Sets `SelectedPage = 'breaches'`, `isProjects = false` | Dynamic |
| Header Timestamp | "Last updated: WO File: ... \| CR File: ..." | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L612) | `getFilesUpdatedata` callback | `res.wofile`, `res.crfile` | Displays backend last modification dates for files | Displays "Not Available" if missing | Formatted via `format(date, 'dd-MM-yyyy HH:mm:ss')` | Dynamic |
| All Projects Radio | "All Projects" + Badge | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L680) | `onSelectProjectType('All Projects')` | `projectData` | Selects all projects across organization types | Checks `selectedPM === 'All Projects'` | Badge count = `projectData.length` | Derived |
| Project Type Radios | Dynamic Depend-On Types + Badge | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L705) | `onSelectProjectType(radio)` | `projectData.Depends_On` | Filters dataset by specific project dependency group | Unique list built by `uniqueProjectType(res)` | Badge count = `filter(prj.Depends_On === radio).length` | Derived |
| Status Group Card 1 | "Inception" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 1` | Displays project count in Inception group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 1).length` | Derived |
| Status Group Card 2 | "Planning" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 2` | Displays project count in Planning group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 2).length` | Derived |
| Status Group Card 3 | "Building" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 3` | Displays project count in Building group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 3).length` | Derived |
| Status Group Card 4 | "Testing" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 4` | Displays project count in Testing group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 4).length` | Derived |
| Status Group Card 5 | "Release Process" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 5` | Displays project count in Release Process group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 5).length` | Derived |
| Status Group Card 6 | "Deployed" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 6` | Displays project count in Deployed group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 6).length` | Derived |
| Status Group Card 7 | "Completed" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L745) | `res.name`, `res.count` | `StatusGroup === 7` | Displays project count in Completed group | Click opens `ProjectExecutive` dialog | Count = `filter(StatusGroup === 7).length` | Derived |
| Status Card | "testing blocked" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L772) | `onShowProjects('Testing Blocked')` | `Status === 'Testing Blocked'` | Displays count of testing blocked work orders | Click opens `Project` dialog | Count = `filter(Status === 'Testing Blocked').length` | Derived |
| Status Card | "deferred" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L801) | `onShowProjects('Deferred')` | `Status === 'Deferred'` | Displays count of deferred work orders | Click opens `Project` dialog | Count = `filter(Status === 'Deferred').length` | Derived |
| View Toggle Icon | BarChart / Checklist Icon | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L842) | `onCardView()` | `showChartIcon` state | Toggles between KPI cards view and Bar chart view | None | Toggles `showChartIcon` boolean | Derived |
| Status Search Dropdown | "Select a Status" / "All" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L880) | `handleStatusChange` | `Status` | Filters table by exact project status | "All" shows all statuses | Filter `Status === selectedStatusSearch.name` | Derived |
| Project Code Input | "Project Code" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L891) | `IPM_number` state | `Ipm_Number` | Filters table by project code substring | Enter triggers search | Substring match `includes(IPM_number)` | Derived |
| ITDL Search Input | "ITDL Search" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L903) | `ITDLSearch` state | `IT_Delivery_Lead` | Filters table by IT Delivery Lead substring | Case-insensitive | Substring match `includes(ITDLSearch)` | Derived |
| PO Search Input | "Product Owner Search" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L914) | `ProductOwnerSearch` state | `Product_Owner` | Filters table by Product Owner substring | Case-insensitive | Substring match `includes(ProductOwnerSearch)` | Derived |
| Start Date Calendar | "Start Date" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L931) | `startDateSearch` state | `Start_Date` | Filters projects starting on or after selected date | `maxDate = today` | Date check `Start_Date >= formattedStartDate` | Derived |
| End Date Calendar | "End Date" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L955) | `endDateSearch` state | `Due_Date` | Filters projects due on or before selected date | `minDate = startDateSearch` | Date check `Due_Date <= formattedEndDate` | Derived |
| Reset Search Button | Clockwise Refresh Icon | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L980) | `reset()` | N/A | Resets all search filters and restores table data | None | Clears all 6 search state variables | Dynamic |
| View Switch Icon | Left-Right Arrows | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L866) | `setState({ statusView: !statusView })` | N/A | Toggles table progress bars between 7 groups and 17 status stages | None | Inverts `statusView` boolean | Dynamic |
| Table Frozen Column | "Project Name" (Info Icon + IPM Number) | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1002) | `ProjectBody(rowData)` | `Ipm_Number` | Displays info icon and project IPM number | Click info icon opens `ProjectInfo1` dialog | Frozen left column rendering | Derived |
| Table Column | "Description" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1011) | `rowData.Summary` | `Summary` | Displays summary text with conditional "More" link | If length > 30, shows substring(0,30)... + More button | Click opens description modal | Derived |
| Table Column | "Status" | [ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1045) | `statusBody(rowData)` | `StatusGroup` / `StatusId` | Renders progress bar of lifecycle stages | If `statusView` false: `ProjectStatusGroup`, if true: `ProjectStatus` | Highlights current stage in gold, completed in green, pending in grey | Derived |
| Count Card 1 | "Count BY IT Delivery Lead" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L98) | `loadComponentData()` | `IT_Delivery_Lead` | Groups projects by IT Delivery Lead name | `myFunc(data, 'IT_Delivery_Lead')` | Returns array of `{ name, count, ProjList }` | Derived |
| Count Card 2 | "Count BY Product Owner" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L101) | `loadComponentData()` | `Product_Owner` | Groups projects by Product Owner name | `myFunc(data, 'Product_Owner')` | Returns array of `{ name, count, ProjList }` | Derived |
| Count Card 3 | "Count BY Backup ITDL" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L105) | `loadComponentData()` | `Backup_IT_Delivery_Lead` | Groups projects by Backup ITDL name | `myFunc(data, 'Backup_IT_Delivery_Lead')` | Returns array of `{ name, count, ProjList }` | Derived |
| Count Card 4 | "Count BY SIT Lead" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L108) | `loadComponentData()` | `SIT_Lead` | Groups projects by SIT Lead name | `myFunc(data, 'SIT_Lead')` | Returns array of `{ name, count, ProjList }` | Derived |
| Count Card 5 | "Count BY UAT Lead" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L111) | `loadComponentData()` | `UAT_Lead` | Groups projects by UAT Lead name | `myFunc(data, 'UAT_Lead')` | Returns array of `{ name, count, ProjList }` | Derived |
| Count Card 6 | "![alt text](image.png)" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L114) | `loadComponentData()` | `Assigned_Developer` (CRData) | Groups CRs by Assigned Developer | `myFunc(crdata, 'Assigned_Developer')` | Returns array of `{ name, count, CRList, WOList }` | Derived |
| Count Card 7 | "Count BY Additional Developer" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L117) | `loadComponentData()` | `Additional_Developers` (CRData) | Groups CRs by Additional Developers | `myFunc(crdata, 'Additional_Developers')` | Returns array of `{ name, count, CRList, WOList }` | Derived |
| Count Card 8 | "Development Completion In Upcoming Days" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L149) | `loadComponentData()` | `End_Date` (CRData) | Categorizes CR development completion into 15, 30, 45, 60 day windows | `today <= CR.End_Date <= today + N days` | Returns 4 bucket counts & lists | Derived |
| Count Card 9 | "Testing Completion In Upcoming Days" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L149) | `loadComponentData()` | `Due_Date` (WOData) | Categorizes WO testing completion into 15, 30, 45, 60 day windows | `today <= WO.Due_Date <= today + N days` | Returns 4 bucket counts & lists | Derived |
| Count Card 10 | "Delivery Completion In Upcoming Days" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L149) | `loadComponentData()` | `UAT_Actual_End_Date` (WOData) | Categorizes delivery completion into 15, 30, 45, 60 day windows | `today <= WO.UAT_Actual_End_Date <= today + N days` | Returns 4 bucket counts & lists | Derived |
| Breaches Card 11 | "Project Breaches" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L208) | `loadComponentData()` | `WOData`, `CRData` | Calculates 7 specific breach categories | Validates date deltas, status IDs, comment text parsing | Item counts for 7 breach metrics | Derived |
| Due Dates Card 12 | "Project Due Dates" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L700) | `loadComponentData()` | `WOData` | Calculates dev completion missing & tight due date windows | Validates null/empty dev date & date difference < 15 days | Item counts for 2 due date metrics | Derived |
| CR Exceptions Card 13 | "CR Exceptions" | [CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L740) | `loadComponentData()` | `WOData`, `CRData` | Calculates 4 CR exception conditions | Compares CR End Date vs WO Due Date, checks empty effort/start/end | Item counts for 4 CR exception metrics | Derived |

---

## 3. Calculation Audit

| ID | Tab | UI Value | Input Fields | Formula / Condition | Output | Source File |
|---|---|---|---|---|---|---|
| CALC-01 | Project Monitoring | Project Status Group Count | `projectData`, `StatusGroup` | `projectData.filter(prj => prj.StatusGroup === group.id).length` | Integer count | [ProjectManagement.js:L358](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L358) |
| CALC-02 | Project Monitoring | Monthly Completed Projects Count | `projectData.Due_Date`, `projectData.Status` | `Status.toLowerCase() === 'completed' ? projectCountsByMonth[monthIndex]++` | Array of 12 month counts | [ProjectManagement.js:L1381](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1381) |
| CALC-03 | Project Monitoring | Quarterly Completed Projects Count | `project.Due_Date` | Month extracted from `Due_Date` mapped to Q1("01","02","03"), Q2, Q3, Q4 | Array of 4 quarter counts | [QuarterlyPMData.js:L60](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/QuarterlyPMData.js#L60) |
| CALC-04 | Project Monitoring | Half-Yearly Completed Projects Count | `project.Due_Date` | `month >= 1 && month <= 6 ? 'Jan-Jun' : 'Jul-Dec'` | Array of 2 half-year counts | [HalfYearlyPMData.js:L50](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/HalfYearlyPMData.js#L50) |
| CALC-05 | Project Monitoring | Annual Completed Projects Count | `project.Due_Date` | Bucket counts for `CurrentYear - 2`, `CurrentYear - 1`, `CurrentYear` | Array of 3 annual counts | [AnnualPMData.js:L59](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/AnnualPMData.js#L59) |
| CALC-06 | Project Monitoring | Project Timeline Status Percentage | `Start_Date`, `Due_Date`, `Status` | If Status === 'Completed': 100%. Else: `Math.round(((currentDate - Start_Date)/(1000*60*60*24) * 100) / ((Due_Date - Start_Date)/(1000*60*60*24)))` | Integer percentage or "-" if over 100% | [ProjectInfo1.js:L451](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js#L451) |
| CALC-07 | Project Monitoring | Project Overdue Days | `Start_Date`, `Due_Date` | `Math.round(TotalCompletedDays - TotalExpectedDuration)` | Integer days overdue | [ProjectInfo1.js:L458](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js#L458) |
| CALC-08 | Project Monitoring | Circular Progress Dash Offset | `sqSize`, `strokeWidth`, `percentage` | `dashArray = radius * Math.PI * 2`; `dashOffset = dashArray - dashArray * percentage / 100` | SVG stroke dashoffset numeric value | [StatusBar.js:L21](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/StatusBar.js#L21) |
| CALC-09 | Project Monitoring | Upcoming Completion Days Filter | `Date` field, `today` | `today <= myDateValue && myDateValue <= today + N * (24*60*60*1000)` where N = 15, 30, 45, 60 | Filtered project/CR array & count | [CountsCard.js:L174](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L174) |
| CALC-10 | Project Breaches | Unclosed Projects > 60 Days | `Start_Date`, `StatusId`, `Status` | `(today - Start_Date)/(1000*60*60*24) > 60 && StatusId !== 16 && StatusId !== 17 && Status !== 'Deferred'` | Filtered list & count | [CountsCard.js:L213](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L213) |
| CALC-11 | Project Breaches | Testing > 15 Days | `SIT_Received_date`, `StatusId` | `(today - SIT_Received_date)/(1000*60*60*24) > 15 && StatusId >= 8 && StatusId <= 12` | Filtered list & count | [CountsCard.js:L227](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L227) |
| CALC-12 | Project Breaches | BRD/SSD Stage > 14 Days | `Start_Date`, `StatusId` | `(today - Start_Date)/(1000*60*60*24) > 14 && StatusId === 2 && StatusId === 3` *(Code issue: `StatusId===2 && StatusId===3` evaluates to false)* | Filtered list & count | [CountsCard.js:L238](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L238) |
| CALC-13 | Project Breaches | Uncommented Projects > 5 Days | `Last_Comment` date regex match, `Status` | `extractLatestCommentWithDate(Last_Comment, 5)` -> `diffDays > 5 && Last_Comment !== '' && Status !== 'Closed'` | Filtered list & count | [CountsCard.js:L568](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L568) |
| CALC-14 | Project Breaches | Empty Planned Dev in 45 Days | `Due_Date`, `Planned_DEV_completion_Date` | `(Planned_DEV_completion_Date === '' \|\| length === 1) && Due_Date >= today && Due_Date <= today + 45 days` | Filtered list & count | [CountsCard.js:L704](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L704) |
| CALC-15 | Project Breaches | Due Date - Dev Completion < 2 Weeks | `Due_Date`, `Planned_DEV_completion_Date` | `(Due_Date - Planned_DEV_completion_Date)/(1000*60*60*24) < 15` | Filtered list & count | [CountsCard.js:L716](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L716) |
| CALC-16 | Project Breaches | CR Due Date > WO Due Date | CR `End_Date`, WO `Due_Date` | Match `cr.Wo_Id === parseInt(wo.Wo_Id)` and `cr.End_Date > wo.Due_Date` | Filtered list & count | [CountsCard.js:L741](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L741) |

---

## 4. Conditional Rendering Audit

| ID | UI Element | Condition | True Behavior | False Behavior | Source |
|---|---|---|---|---|---|
| COND-01 | Tab Navigation Group | `hasPmDashAccess && hasBreachesAccess` | Displays `ButtonGroup` with tab toggle buttons | Hides tab toggle buttons | [ProjectManagement.js:L636](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L636) |
| COND-02 | Main Page Title Timestamp | `lastupdated_wofile \|\| lastupdated_crfile` | Renders "Last updated: WO File: ... \| CR File: ..." header | Renders title without timestamp | [ProjectManagement.js:L608](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L608) |
| COND-03 | Project Monitoring Main Content | `isProjects === true` | Renders radio filters, status cards/chart, table, trend tabs | Hides PM content (shows `ProjectBreaches`) | [ProjectManagement.js:L674](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L674) |
| COND-04 | KPI Cards vs Bar Chart | `showChartIcon === false` | Renders 7 status group PMCards + 2 status PMCards | Renders PrimeReact `Chart` bar component | [ProjectManagement.js:L743](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L743) |
| COND-05 | Table Progress View Mode | `statusView === false` | Renders `ProjectStatusGroup` (7 high-level status groups) | Renders `ProjectStatus` (17 detailed SDLC stages) | [ProjectManagement.js:L167](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L167) |
| COND-06 | Description "More" Button | `Summary.length > 30` | Displays substring(0, 30)... + "More" link | Displays full summary string directly | [ProjectManagement.js:L1019](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1019) |
| COND-07 | Breaches Card Display | `showCard === true` | Renders Cards 11, 12, 13 (Breaches, Due Dates, Exceptions) | Renders "No Data Found in Project Breaches" card | [ProjectBreaches.js:L127](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectBreaches.js#L127) |
| COND-08 | Export Button | `isAdmin \|\| can_export` | Renders `ExportTableComponent` button dropdown | Hides export button dropdown | [ProjectExecutive.js:L117](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectExecutive.js#L117) |
| COND-09 | Project Info Chart & Timeline | `CRDev` exists | Calculates & renders lifecycle bar chart dataset | Skips chart dataset creation | [ProjectInfo1.js:L396](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js#L396) |

---

## 5. Filter Dependency Audit

| Filter | Affects Table | Affects Cards | Affects Charts | Affects Breach Counts | API Call Triggered | Filter Mode | Scope |
|---|---|---|---|---|---|---|---|
| Project Type Radio (`selectedPM`) | Yes | Yes (Status Group cards & CountsCards) | Yes (Bar chart & Trend charts) | No | No (Client-side) | Client-side | Entire Tab |
| Status Search Dropdown | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| Project Code Input (`IPM_number`) | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| ITDL Search Input (`ITDLSearch`) | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| Product Owner Input (`ProductOwnerSearch`) | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| Start Date Calendar (`startDateSearch`) | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| End Date Calendar (`endDateSearch`) | Yes (`FilterProjectGridData`) | No | No | No | No (Client-side) | Client-side | Main Table Only |
| Global Search in Drill-down Modals | Yes (Modal Table) | No | No | No | No (Client-side) | Client-side | Modal Table Only |

---

## 6. Complete Data Lineage

```text
Backend Database / Excel Source File
       │
       ▼
REST Endpoint: GET /importworkorderstatusfile
       │
       ▼
ProjectManagementService.getProjectManagementData(callback)
       │
       ▼
Response Validation: res.isSuccess === true
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
Work Orders (res.result1)                 Change Requests (res.result2)
       │                                         │
       ▼                                         ▼
buildProjectData(result1)                 Stored in state CRData
  - Parse Wo_Id to Integer                  - Filtered by Wo_Id matching
  - Map Status -> StatusId & StatusGroup         
       │
       ▼
State: projectData
       │
       ├────────────────────────────────────────────────────────────────────────┐
       ▼                                                                        ▼
onProjectTypeChange('All Projects' / radio)                             CountsCard Component
  - Filters projectData by Depends_On                                     - Groups by ITDL, PO, Dev
  - Recalculates statusGroupsList counts                                  - Evaluates Breach rules 11-13
  - Calls buildChartData()                                                - Displays Count Badge
       │                                                                        │
       ▼                                                                        ▼
State: FilterProjectData & FilterProjectGridData                        Drill-down Modal (Project.js)
       │                                                                - Displays filtered WO/CR table
       ▼                                                                - Renders Export Excel/PDF
onSearchProject()
  - Applies Status, IPM Number, ITDL, PO, Start/End Date filters
       │
       ▼
State: FilterProjectGridData
       │
       ▼
PrimeReact DataTable Rendering
  - Frozen column: Project Body with Info Circle Icon
  - Description column: Substring (30 chars) + 'More' modal link
  - Status column: ProjectStatusGroup (7 groups) OR ProjectStatus (17 stages)
       │
       ▼
User Click on Info Circle Icon
       │
       ▼
Modal Dialog: ProjectInfo1
  - Displays LeftTable (Metadata) & RightTable (Roles & Dates)
  - Calculates TotalExpectedDuration vs TotalCompletedDays
  - Computes Status Percentage & Overdue Days
  - Renders Circular Progress Bar (StatusBar.js) & Lifecycle Chart
```

---

## 7. Page Overview

### Purpose
The **Project Monitoring** page provides IT delivery leadership, project managers, product owners, and executive stakeholders with real-time oversight of all ongoing, planned, and completed software development projects and Work Orders (WOs), along with associated Change Requests (CRs).

### Business Objective
* Track project progress across standard SDLC stages and high-level management status groups.
* Detect project bottlenecks, delivery delays, overdue milestones, and governance breach exceptions.
* Analyze delivery performance trends over monthly, quarterly, half-yearly, and annual periods.
* Provide interactive drill-down capabilities from aggregate metrics to granular Work Order and Change Request details.

### Target Audience
* **IT Delivery Lead (ITDL)**: Monitors progress across assigned project portfolios.
* **Product Owner (PO)**: Tracks project completion timelines, scope changes, and release readiness.
* **PMO / Project Manager**: Manages schedule adherence, resource allocation, and governance compliance.
* **Executive Leadership**: Reviews high-level status distribution, breach metrics, and quarterly trends.

### Data Flow Overview
`API (importworkorderstatusfile) → Response Validation (isSuccess check) → Data Transformation (buildProjectData ID parsing & status mapping) → Local Component State (projectData, FilterProjectData, CRData) → Search & Type Filtering → Calculations (Group Counts, Timeline %, Overdue Days, Breach Rule Matrix) → UI Component Rendering (Cards, DataTable, Trend Charts, Dialog Modals)`

### Module Dependencies
* **Auth & Permission System (`OSSSystem.User`)**: Validates `pmDash` and `pmBr` module access and export capabilities.
* **Event System (`OSSEventNames`)**: Handles language refresh (`REFRESH_LANGUAGE`) and side menu toggling (`TOGGLE_SIDE_MENU`).
* **Services (`ProjectManagementService`)**: Manages HTTP GET requests for runtime Work Order and Change Request datasets, as well as file modification metadata (`getFileUpdate`, `getAllfilesUpdate`).

---

## 8. Project Monitoring Tab — Detailed UI Audit

### Header & Navigation Controls
1. **Page Title**: Text label displaying `"Project Monitoring"` or `"Project Breaches"` based on `SelectedPage` state.
2. **File Update Timestamp**: Header text displaying `"Last updated: WO File: [DD-MM-YYYY HH:mm:ss] | CR File: [DD-MM-YYYY HH:mm:ss]"`.
3. **Tab Toggle Buttons**: `ButtonGroup` containing two buttons ("Project Monitoring" with screen icon and "Project Breaches" with file icon). Visible only if user has access to both permissions (`hasPmDashAccess` and `hasBreachesAccess`).

### Filter & Overview Controls
4. **Project Type Radio Group**: Horizontal radio selection list starting with `"All Projects"` (badge showing total project count) followed by dynamic radio options for each unique `Depends_On` value (e.g., "Not Available", specific parent projects/systems) with individual count badges.
5. **Status Group Cards Carousel**: Row of 7 `PMCard` components displaying counts for:
   * **Inception** (Cyan, ID: 1)
   * **Planning** (Blue, ID: 2)
   * **Building** (Yellow, ID: 3)
   * **Testing** (Purple, ID: 4)
   * **Release Process** (Teal, ID: 5)
   * **Deployed** (Green, ID: 6)
   * **Completed** (Dark Green, ID: 7)
6. **Exception Cards**:
   * **testing blocked**: Red card (`#d33f49`) showing count of projects with `Status === "Testing Blocked"`.
   * **deferred**: Grey card (`#868d95`) showing count of projects with `Status === "Deferred"`.
7. **View Mode Toggle Icon**: Circular grey button on the right of cards row that toggles `showChartIcon`. When clicked, replaces the 9 cards with a bar chart representation of status counts.

### Search & Data Table Section
8. **Table Section Header**: Card header labeled `"Project Status"` with a swap icon (`TbArrowsRightLeft`) on the right. Clicking the swap icon toggles `statusView` between high-level group progress bars and granular 17-stage progress bars.
9. **Filter Bar**:
   * **Status Dropdown**: Select dropdown with options `["All", ...PMStatus]`. Selecting an option filters `FilterProjectGridData` immediately.
   * **Project Code Input**: Text input searching `Ipm_Number`. Triggers on Enter key press or Backspace reset.
   * **ITDL Search Input**: Text input searching `IT_Delivery_Lead`. Triggers on Enter key press.
   * **Product Owner Search Input**: Text input searching `Product_Owner`. Triggers on Enter key press.
   * **Start Date Calendar**: PrimeReact `Calendar` selecting `startDateSearch` (formatted `YYYY-MM-DD`). Filters projects where `Start_Date >= selectedDate`.
   * **End Date Calendar**: PrimeReact `Calendar` selecting `endDateSearch` (formatted `YYYY-MM-DD`). Filters projects where `Due_Date <= selectedDate`.
   * **Reset Button**: Refresh icon (`bi-arrow-clockwise`) clearing all search inputs and restoring table data.
10. **Main Project Grid (`DataTable`)**:
    * **Frozen Left Column ("Project Name")**: Displays a green info icon (`BsFillInfoCircleFill`) followed by `Ipm_Number`. Clicking the info icon opens the `ProjectInfo1` modal.
    * **Description Column**: Displays `Summary`. If `Summary.length > 30`, truncates text and appends a `"More"` button which opens a text dialog modal.
    * **Status Column**: Renders progress bar visualization:
      * `statusView === false`: Renders `ProjectStatusGroup` (7 progress segments).
      * `statusView === true`: Renders `ProjectStatus` (17 progress segments proportional to label character length).

### Metrics & Analytics Section
11. **Count BY Metrics Cards**: Grid of 10 `CountsCard` components:
    * Card 1: Count BY IT Delivery Lead
    * Card 2: Count BY Product Owner
    * Card 3: Count BY Backup ITDL
    * Card 4: Count BY SIT Lead
    * Card 5: Count BY UAT Lead
    * Card 6: Count BY Developer
    * Card 7: Count BY Additional Developer
    * Card 8: Development Completion In Upcoming Days (15, 30, 45, 60 days)
    * Card 9: Testing Completion In Upcoming Days (15, 30, 45, 60 days)
    * Card 10: Delivery Completion In Upcoming Days (15, 30, 45, 60 days)
12. **Completed Projects Trends Tabs**: Card containing tabbed trend charts:
    * **Monthly Tab**: Bar chart showing monthly completion counts for January through December of current projects.
    * **Quarterly Tab**: Renders `QuarterlyPMData` component (Q1, Q2, Q3, Q4 completion counts).
    * **HalfYearly Tab**: Renders `HalfYearlyPMData` component (Jan-Jun, Jul-Dec completion counts).
    * **Annually Tab**: Renders `AnnualPMData` component (completion counts for `CurrentYear - 2`, `CurrentYear - 1`, `CurrentYear`).

---

## 9. Project Monitoring Data Model

| Field | API Field | Type | Description | Required? | Validation | Transformation | UI Usage |
|---|---|---|---|---|---|---|---|
| Work Order ID | `Wo_Id` | Integer / String | Unique identifier for Work Order | Yes | Parsed to Integer via `parseInt()` | `myrow.Wo_Id = parseInt(myrow.Wo_Id)` | Matching CRs with WOs (`cr.Wo_Id === wo.Wo_Id`) |
| IPM Project Code | `Ipm_Number` | String | Public project tracking code | Yes | Non-empty string | Direct display / Substring(0, 25) | Table frozen column, Headers, Modals |
| Project Summary | `Summary` | String | High-level summary of project scope | No | String | Checked for length > 30 for truncation | Table Description column, Dialogs |
| Detailed Description | `Description` | String | Complete narrative of project requirements | No | String | Checked for length > 30 for truncation | `ProjectInfo1` modal description overlay |
| Project Status | `Status` | String | Current status text (e.g., "In Development") | Yes | Matched against `StaticData.PMStatus` | Map `Status` to `StatusId` & `StatusGroup` | Status cards, progress bars, filter options |
| Status ID | `StatusId` | Integer | Numeric ID of status stage (1 to 17) | Yes | 1 <= StatusId <= 17 | Derived from `PMStatus.find(name === Status).id` | Progress bar calculation, table filter `StatusId > 0` |
| Status Group ID | `StatusGroup` | Integer | Numeric ID of high-level group (1 to 7) | Yes | 1 <= StatusGroup <= 7 | Derived from `PMStatus.find(name === Status).groupid` | Group KPI cards, Executive modal filtering |
| Project Start Date | `Start_Date` | String / Date | Official project start date (YYYY-MM-DD) | Yes | Valid date string | Parsed via `new Date()` | Date filtering, Timeline status %, Overdue days |
| Due Date / Finish Date | `Due_Date` | String / Date | Target completion date for Work Order | Yes | Valid date string | Parsed via `new Date()` | Date filtering, Overdue calculation, Trend charts |
| Planned Dev Completion | `Planned_DEV_completion_Date` | String / Date | Target date for development completion | No | May be empty `""` or single char `" "` | Checked `Planned_DEV_completion_Date === ""` | Breaches Card 12 checks, `ProjectInfo1` modal |
| SIT Received Date | `SIT_Received_date` | String / Date | Date Work Order entered SIT testing | No | Valid date string | Parsed via `new Date()` | Breaches Card 11 (Testing > 15 days), `ProjectInfo1` |
| UAT Actual End Date | `UAT_Actual_End_Date` | String / Date | Date UAT testing was completed | No | Valid date string | Parsed via `new Date()` | Card 10 (Delivery Completion in Upcoming Days), `ProjectInfo1` |
| IT Delivery Lead | `IT_Delivery_Lead` | String | Name of assigned IT Delivery Lead | Yes | String | Direct display | Card 1 grouping, Table column, Search filter |
| Backup ITDL | `Backup_IT_Delivery_Lead` | String | Name of backup IT Delivery Lead | No | String | Direct display | Card 3 grouping, Table column |
| Product Owner | `Product_Owner` | String | Name of assigned Product Owner | Yes | String | Direct display | Card 2 grouping, Table column, Search filter |
| PMO Project Manager | `PMO_Project_Manager` | String | Assigned PMO manager | No | String | Direct display | Table column, `ProjectInfo1` modal |
| Requestor Name | `Requestor_Name` | String | Name of person initiating project | No | String | Direct display | `ProjectInfo1` modal |
| Owned By | `Owned_By` | String | Department/Unit owning the project | No | String | Direct display | `ProjectInfo1` modal |
| Priority | `Priority` | String | Priority level (e.g., High, Medium) | No | String | Direct display | `ProjectInfo1` modal |
| Work Order Type | `Work_Order_Type` | String | Type classification of Work Order | No | String | Direct display | `ProjectInfo1` modal |
| Dependency Group | `Depends_On` | String | Parent project or dependency system | No | Standardized if single char or empty | `if (Depends_On.length <= 1) Depends_On = "Not Available"` | Radio button filter grouping |
| Last Comment | `Last_Comment` | String | Historical log of comments with dates | No | String | Regex parsing for dates `([A-Z][a-z]{2} \d{1,2}, \d{4})` | Breaches Card 11 (No comments > 5 days), Modal column |
| CR Assigned Developer | `Assigned_Developer` | String | Primary developer assigned to CR | No | String (CRData) | Direct display | Card 6 grouping, CR table column |
| CR Additional Developers | `Additional_Developers` | String | Secondary developers assigned to CR | No | String (CRData) | Direct display | Card 7 grouping, CR table column |
| CR Effort in MDs | `Effort_in_MDs` | String / Integer | Effort estimated in Man-Days | No | Numeric string (CRData) | Parsed via `parseInt()` | Breaches Card 13 (No Man Days in CR check) |
| CR Start Date | `Start_Date` (CR) | String / Date | Start date of Change Request | No | String (CRData) | Parsed via `new Date()` | Breaches Card 13 (No Start in CR check) |
| CR End Date / Due Date | `End_Date` (CR) | String / Date | End date / due date of Change Request | No | String (CRData) | Parsed via `new Date()` | Card 8 upcoming completion, Breaches Card 11 & 13 |

---

## 10. API Integration Documentation

### 1. `importworkorderstatusfile`
* **Endpoint**: `/importworkorderstatusfile`
* **HTTP Method**: GET
* **Service Method**: `OSSSystem.services.projectManagementService.getProjectManagementData(afterResponse)`
* **Request Params**: None (`0`)
* **Response Structure**:
  ```json
  {
    "isSuccess": true,
    "result1": [ /* Array of Work Order Project Objects */ ],
    "result2": [ /* Array of Change Request (CR) Objects */ ]
  }
  ```
* **Error Handling**: Displays Toast error notification: `"Failed - Error: Check Log for more information"` or `"Failed - Error: Error Occured"`.
* **Consumer Components**: `ProjectManagement.js`, `ProjectBreaches.js`, `ProjectExecutive.js`.
* **Sharing**: Shared between both Project Monitoring and Project Breaches tabs.

### 2. `getallfilesupdate`
* **Endpoint**: `/getallfilesupdate`
* **HTTP Method**: GET
* **Helper Function**: `getFilesUpdatedata(callback)` in `src/Components/Utils/functions.js`
* **Response Structure**:
  ```json
  {
    "isSuccess": true,
    "result": {
      "file_updates": {
        "wofile": "2026-08-10T10:30:00Z",
        "crfile": "2026-08-10T10:30:00Z"
      }
    }
  }
  ```
* **Consumer Components**: `ProjectManagement.js`.

### 3. `getfileupdate`
* **Endpoint**: `/getfileupdate`
* **HTTP Method**: POST / GET (JSON body `{ file_name: "wofile" }`)
* **Helper Function**: `getFileUpdatedata({ file_name: "wofile" }, callback)` in `src/Components/Utils/functions.js`
* **Response Structure**:
  ```json
  {
    "isSuccess": true,
    "result": {
      "file_updates": {
        "wofile": "2026-08-10T10:30:00Z"
      }
    }
  }
  ```
* **Consumer Components**: `ProjectBreaches.js`.

---

## 11. Project Monitoring Calculations & Business Logic

### 1. Project Timeline & Status Percentage (`ProjectInfo1.js`)
* **Inputs**: `Start_Date`, `Due_Date`, `Status`
* **Logic**:
  * If `Status === "Completed"`, status percentage is set to `100%` and status text is `"Completed"`. Progress bar color code is `#83AF9B`.
  * If `Status !== "Completed"`:
    * `TotalExpectedDuration = (Due_Date - Start_Date) / (1000 * 60 * 60 * 24)`
    * `TotalCompletedDays = (CurrentDate - Start_Date) / (1000 * 60 * 60 * 24)`
    * `StatusPercentage = Math.round((TotalCompletedDays * 100) / TotalExpectedDuration)`
    * If `StatusPercentage > 100`:
      * `OverdueDays = Math.round(TotalCompletedDays - TotalExpectedDuration)`
      * Status Text = `Status + " ( Over Due for - " + OverdueDays + " Days)"`
      * Status Percentage = `"-"`
      * Progress Bar Color Code = `#E8175D` (Red Alert)
    * If `StatusPercentage <= 100`:
      * Status Text = `Status`
      * Status Percentage = `StatusPercentage`
      * Progress Bar Color Code = `#2F9599` (Teal Normal)

### 2. Status Group Metrics Calculation (`ProjectManagement.js`)
* **Inputs**: `projectData`, `StaticData.PMStatusGroups`
* **Logic**:
  * For each group in `PMStatusGroups` (IDs 1 through 7):
    `group.count = projectData.filter(prj => prj.StatusGroup === group.id).length`

### 3. Date Boundary & Null Date Handling
* **Null / Empty Date String Handling**:
  * If date field string is empty `""` or string length is `1`, treated as unassigned/not specified.
  * Formatted output returns empty string `""` or `"-"`.
* **Weekend / Time-Zone Handling**:
  * Dates parsed using Standard JavaScript `Date` constructor (`new Date(dateString)`).
  * Date difference calculated purely in calendar day deltas (`(DateA - DateB) / (1000 * 60 * 60 * 24)`). Calendar days include weekends and public holidays.

---

## 12. Project Lifecycle & Stage Logic

### High-Level Status Groups (7 Groups)

| Group ID | Group Name | Target Weight (`value`) | Hex Color Code | Stage Scope |
|---|---|---|---|---|
| 1 | Inception | 20 | `#49c8ee` | Open stage |
| 2 | Planning | 14 | `#0d6efd` | BRD Analysis, SSD Analysis, In Design |
| 3 | Building | 10 | `#ffc107` | In Development, Development Completed |
| 4 | Testing | 15 | `#a964e1` | FAT Testing, SIT Checkpoint, Smoke Testing, SIT Progress, UAT Checkpoint, UAT Progress, UAT Sign Off |
| 5 | Release Process | 26 | `#36a49b` | Release Approval, Ready For Production |
| 6 | Deployed | 23 | `#20c769` | Deployed |
| 7 | Completed | 8 | `#198754` | Completed |

### Granular SDLC Status Stages (17 Stages)

| Status ID | Status Name | Parent Group ID | Hex Color Code | Stage Category |
|---|---|---|---|---|
| 1 | Open | 1 | `#49c8ee` | Inception |
| 2 | BRD Analysis | 2 | `#86B7FE` | Planning |
| 3 | SSD Analysis | 2 | `#5E9EFE` | Planning |
| 4 | In Design | 2 | `#3586FD` | Planning |
| 5 | In Development | 3 | `#FFD65A` | Building |
| 6 | Development Completed | 3 | `#FFCB30` | Building |
| 7 | FAT Testing | 4 | `#A964E1` | Testing |
| 8 | SIT Entry Checkpoint | 4 | `#AF71E2` | Testing |
| 9 | Smoke Testing | 4 | `#B67DE4` | Testing |
| 10 | SIT in Progress | 4 | `#BC8AE5` | Testing |
| 11 | UAT Entry Checkpoint | 4 | `#C397E6` | Testing |
| 12 | UAT InProgress | 4 | `#C9A4E8` | Testing |
| 13 | UAT Sign Off | 4 | `#D0B0E9` | Testing |
| 14 | Release Approval | 5 | `#47ABA3` | Release |
| 15 | Ready For Production | 5 | `#36a49b` | Release |
| 16 | Deployed | 6 | `#20c769` | Production |
| 17 | Completed | 7 | `#198754` | Production |

### Progress Bar Stage Coloring Logic (`ProjectStatusGroup.js` & `ProjectStatus.js`)
* **Current Active Stage (`StatusId === stage.id` or `StatusGroup === stage.id`)**: Highlighted in Gold (`#e7b10d`).
* **Completed Previous Stages (`StatusId > stage.id` or `StatusGroup > stage.id`)**: Rendered in Green (`#188754`).
* **Pending Future Stages (`StatusId < stage.id` or `StatusGroup < stage.id`)**: Rendered in Light Grey (`#ced0d1`).

---

## 13. Project Monitoring Filters

### 1. Project Type Radio Filter (`selectedPM`)
* **Type**: Single-select Radio buttons.
* **Values**: `"All Projects"` + unique values extracted from `Depends_On`.
* **Behavior**: Filtering updates `FilterProjectData` and `FilterProjectGridData`. Recalculates status group card counts and bar chart dataset.

### 2. Status Dropdown Search (`selectedStatusSearch`)
* **Type**: PrimeReact `Dropdown`.
* **Values**: `"All"` + 17 items from `StaticData.PMStatus`.
* **Behavior**: Selecting an option filters `FilterProjectGridData` where `x.Status === selectedStatusSearch.name`.

### 3. Project Code Text Search (`IPM_number`)
* **Type**: `InputText`.
* **Behavior**: Substring case-insensitive match on `Ipm_Number`. Executed on `Enter` key press.

### 4. IT Delivery Lead Search (`ITDLSearch`)
* **Type**: `InputText`.
* **Behavior**: Substring case-insensitive match on `IT_Delivery_Lead`. Executed on `Enter` key press.

### 5. Product Owner Search (`ProductOwnerSearch`)
* **Type**: `InputText`.
* **Behavior**: Substring case-insensitive match on `Product_Owner`. Executed on `Enter` key press.

### 6. Start Date Range Calendar (`startDateSearch`)
* **Type**: PrimeReact `Calendar` (`dateFormat="yy-mm-dd"`).
* **Behavior**: Filters projects where `Start_Date >= formattedStartDate`. Restricted by `maxDate = today`.

### 7. End Date Range Calendar (`endDateSearch`)
* **Type**: PrimeReact `Calendar` (`dateFormat="yy-mm-dd"`).
* **Behavior**: Filters projects where `Due_Date <= formattedEndDate`. Restricted by `minDate = startDateSearch`.

---

## 14. Search, Sorting & Pagination

### Search Logic
* Multi-criteria client-side filtering executed in `onSearchProject()`:
  ```js
  filterList = filterList
    .filter(x => selectedStatusSearch === 'All' || x.Status === selectedStatusSearch.name)
    .filter(x => !IPM_number || x.Ipm_Number.toLowerCase().includes(IPM_number.toLowerCase()))
    .filter(x => !ITDLSearch || x.IT_Delivery_Lead.toLowerCase().includes(ITDLSearch.toLowerCase()))
    .filter(x => !ProductOwnerSearch || x.Product_Owner.toLowerCase().includes(ProductOwnerSearch.toLowerCase()))
    .filter(x => !startDateSearch || x.Start_Date >= formattedStartDate)
    .filter(x => !endDateSearch || x.Due_Date <= formattedEndDate);
  ```

### Sorting & Pagination
* Main Grid scroll height calculated dynamically based on window height (`window.innerHeight - 300`).
* Modal Datatables (`CustomDataTable`) use PrimeReact `DataTable` pagination:
  * Default rows per page = `7`.
  * Page options generated dynamically via `getRowsPerPageOptions()` based on total record count (`[7, 10, 20, 50, ... dynamic options]`).

---

## 15. Project Details / Expanded View Logic (`ProjectInfo1.js`)

When a user clicks the green info circle icon (`BsFillInfoCircleFill`) on any project row, the `ProjectInfo1` dialog modal opens.

### Left Information Table
* **Project Summary**: Displays `Summary`. Click "More" opens raw text modal if length > 30.
* **IPM Number**: Displays `data.Ipm_Number`.
* **IT Delivery Lead**: Displays `data.IT_Delivery_Lead`.
* **Product Owner**: Displays `data.Product_Owner`.
* **Owned By**: Displays `data.Owned_By`.
* **Clarity Planned Finish Date**: Formatted date `formatDate(Clarity_Planned_Finish_Date)`.
* **Start Date**: Formatted date `formatDate(Start_Date)`.

### Right Information Table
* **Work Order Type**: Displays `data.Work_Order_Type`.
* **Priority**: Displays `data.Priority`.
* **Backup IT Delivery Lead**: Displays `data.Backup_IT_Delivery_Lead`.
* **PMO Project Manager**: Displays `data.PMO_Project_Manager`.
* **Last Comment**: Displays `data.Last_Comment`.
* **Requestor Name**: Displays `data.Requestor_Name`.
* **Planned Dev Completion Date**: Formatted date `formatDate(Planned_DEV_completion_Date)`.
* **End Date**: Formatted date `formatDate(Due_Date)`.

### Bottom Charts & Timeline
* **Project Life Cycle Bar Chart**:
  * Computes durations in days for:
    * `Planning = (minCRDesignStartDate - WOStartDate) / (1000 * 60 * 60 * 24)`
    * `Development = (maxCRDevEndDate - minCRDevStartDate) / (1000 * 60 * 60 * 24)`
    * `Testing = (WOUATActucalEndDate - WOSITRecivedTestingStartDate) / (1000 * 60 * 60 * 24)`
    * `Delivered = (WOEndDate - WOStartDate) / (1000 * 60 * 60 * 24)`
* **Circular Timeline Progress Bar (`StatusBar.js`)**:
  * Displays SVG circular progress with calculated `percentage` and status text.

---

## 16. Project Breaches Tab — Complete Documentation

The **Project Breaches** tab (`ProjectBreaches.js`) provides automated detection of project management compliance exceptions, schedule slippages, and Change Request governance breaches.

### Structure & Layout
* Contains three primary summary cards rendered via `CountsCard.js`:
  1. **Breaches Card** (`cardid={11}`): Title `"Breaches"`.
  2. **Due Dates Card** (`cardid={12}`): Title `"Due Dates"`.
  3. **CR Exceptions Card** (`cardid={13}`): Title `"CR Exceptions"`.

---

## 17. Breach Calculation Matrix

| Breach Metric Title | Card ID | Source Fields | Condition / Formula | Threshold | Output Status | UI Location |
|---|---|---|---|---|---|---|
| Unclosed Projects Started Before 60 Days | 11 | `Start_Date`, `StatusId`, `Status` | `(today - Start_Date) > 60 days && StatusId !== 16 && StatusId !== 17 && Status !== 'Deferred'` | > 60 Days | Breach Alert | Card 11, Item 1 |
| Project in Testing for more than 15 Days | 11 | `SIT_Received_date`, `StatusId` | `(today - SIT_Received_date) > 15 days && StatusId >= 8 && StatusId <= 12` | > 15 Days | Testing Breach | Card 11, Item 2 |
| Project in BRD/SSD Stage for more than 14 Days | 11 | `Start_Date`, `StatusId` | `(today - Start_Date) > 14 days && StatusId === 2 && StatusId === 3` *(Code Bug: Condition evaluates to false)* | > 14 Days | Stage Warning | Card 11, Item 3 |
| Any CR whose due date passed | 11 | CR `End_Date`, CR `Status` | `CR.End_Date < today && CR.Status === 'Open' && CR.Status === 'Development In Progress'` *(Code Bug: Condition evaluates to false)* | Overdue Date | Schedule Breach | Card 11, Item 4 |
| CR in progress stage, but WO moved to Testing | 11 | CR `Status`, WO `StatusId` | `(CR.Status === 'Open' \|\| CR.Status === 'Development In Progress') && WO.StatusId >= 7` | Status Mismatch | Governance Exception | Card 11, Item 5 |
| CR in Open stage, but WO moved to Development | 11 | CR `Status`, WO `StatusId` | `CR.Status === 'Open' && WO.StatusId >= 5` | Status Mismatch | Governance Exception | Card 11, Item 6 |
| Projects with no comments for more than 5 days | 11 | `Last_Comment`, `Status` | Regex date extracted from comment string: `(today - latestCommentDate) > 5 days && Status !== 'Closed'` | > 5 Days | Staleness Warning | Card 11, Item 7 |
| Empty Planned Development Completion in Next 45 Days | 12 | `Due_Date`, `Planned_DEV_completion_Date` | `(Planned_DEV_completion_Date === '' \|\| length === 1) && Due_Date >= today && Due_Date <= today + 45 days` | Missing Date | Data Breach | Card 12, Item 1 |
| Due Date - Dev Completion < 2 Weeks | 12 | `Due_Date`, `Planned_DEV_completion_Date` | `(Due_Date - Planned_DEV_completion_Date) < 15 days` | < 15 Days | Risk Warning | Card 12, Item 2 |
| CR Due Date > WO Due Date | 13 | CR `End_Date`, WO `Due_Date` | `CR.End_Date > WO.Due_Date` (Matching `cr.Wo_Id === wo.Wo_Id`) | Date Extension | Governance Exception | Card 13, Item 1 |
| No Man Days in CR | 13 | CR `Effort_in_MDs` | `parseInt(Effort_in_MDs) === 0 \|\| Effort_in_MDs === ''` | 0 or Blank | Data Missing | Card 13, Item 2 |
| No Start in CR | 13 | CR `Start_Date` | `Start_Date === '' \|\| Start_Date.length === 1` | Blank Date | Data Missing | Card 13, Item 3 |
| No Due Date in CR | 13 | CR `End_Date` | `End_Date === '' \|\| End_Date.length === 1` | Blank Date | Data Missing | Card 13, Item 4 |

---

## 18. Project Breaches Validation Logic

* **Missing Data vs Breach**:
  * Missing dates (e.g. `Planned_DEV_completion_Date === ""`) are specifically classified under Card 12 Item 1 ("Empty Planned Development Completion") if project `Due_Date` falls within 45 days.
  * Missing Effort or Dates in Change Requests are explicitly classified as Governance Exceptions under Card 13 ("No Man Days", "No Start", "No Due Date").
* **Stale Comment Extraction Algorithm (`CountsCard.js`)**:
  * Parses multi-line comments using regex `([A-Z][a-z]{2} \d{1,2}, \d{4})` (e.g. "Aug 10, 2026").
  * Identifies the newest date among all comment entries.
  * Computes day difference from today: `diffDays = Math.ceil(Math.abs(today - latestDate) / (1000 * 60 * 60 * 24))`.
  * If `diffDays > 5` and `Status !== "Closed"`, adds work order to stale comment breach count.

---

## 19. Dashboard Cards / Counters / Metrics Summary

### Project Monitoring Tab Cards
* **Cards 1 to 5 (Role Aggregations)**:
  * Formula: `COUNT(projects) GROUP BY IT_Delivery_Lead / Product_Owner / Backup_IT_Delivery_Lead / SIT_Lead / UAT_Lead`.
* **Cards 6 & 7 (Developer Aggregations)**:
  * Formula: `COUNT(change_requests) GROUP BY Assigned_Developer / Additional_Developers`.
* **Cards 8 to 10 (Upcoming Milestones)**:
  * Formula: `COUNT(records) WHERE today <= date_field <= today + N_days` (N = 15, 30, 45, 60).

### Project Breaches Tab Cards
* **Card 11 (Breaches)**: Aggregate list box containing 7 rule metrics.
* **Card 12 (Due Dates)**: Aggregate list box containing 2 schedule risk metrics.
* **Card 13 (CR Exceptions)**: Aggregate list box containing 4 governance exception metrics.

---

## 20. Charts & Visualizations

### 1. Main Status Group Bar Chart (`ProjectManagement.js`)
* **Type**: PrimeReact `Chart` (Bar).
* **Dataset**: Counts of projects across 7 Status Groups + Testing Blocked + Deferred.
* **Colors**: Blue (`#49c8ee`), Blue (`#0d6efd`), Yellow (`#ffc107`), Purple (`#a964e1`), Teal (`#36a49b`), Green (`#20c769`), Dark Green (`#198754`), Red (`#d33f49`), Grey (`#868d95`).

### 2. Monthly Completed Projects Bar Chart (`ProjectManagement.js`)
* **Type**: PrimeReact `Chart` (Bar).
* **X-Axis**: 12 Months (January - December).
* **Y-Axis**: Count of projects where `Status.toLowerCase() === 'completed'` grouped by `Due_Date.getMonth()`.

### 3. Quarterly PM Data Chart (`QuarterlyPMData.js`)
* **X-Axis**: `["Jan - Mar", "Apr - Jun", "Jul - Sep", "Aug - Dec"]`.
* **Data**: Count of projects where `Due_Date` month falls in Q1, Q2, Q3, or Q4 arrays.

### 4. Half-Yearly PM Data Chart (`HalfYearlyPMData.js`)
* **X-Axis**: `["Jan - Jun", "Jul - Dec"]`.
* **Data**: Count of projects where `Due_Date` month is 1-6 vs 7-12.

### 5. Annual PM Data Chart (`AnnualPMData.js`)
* **X-Axis**: `[CurrentYear - 2, CurrentYear - 1, CurrentYear]`.
* **Data**: Count of projects grouped by `Due_Date.getFullYear()`.

---

## 21. Date Filters & Timeline Logic

* **Date Formatting**: `format(date, "dd-MM-yyyy HH:mm:ss")` for timestamps, `.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })` for table dates.
* **Search Date Inputs**: `en-CA` format (`YYYY-MM-DD`) used for string comparisons (`Start_Date >= formattedStartDate`).

---

## 22. Status Mapping

| Backend / API Status String | Status ID | Group ID | Group Label | UI Color Code |
|---|---|---|---|---|
| Open | 1 | 1 | Inception | `#49c8ee` |
| BRD Analysis | 2 | 2 | Planning | `#86B7FE` |
| SSD Analysis | 3 | 2 | Planning | `#5E9EFE` |
| In Design | 4 | 2 | Planning | `#3586FD` |
| In Development | 5 | 3 | Building | `#FFD65A` |
| Development Completed | 6 | 3 | Building | `#FFCB30` |
| FAT Testing | 7 | 4 | Testing | `#A964E1` |
| SIT Entry Checkpoint | 8 | 4 | Testing | `#AF71E2` |
| Smoke Testing | 9 | 4 | Testing | `#B67DE4` |
| SIT in Progress | 10 | 4 | Testing | `#BC8AE5` |
| UAT Entry Checkpoint | 11 | 4 | Testing | `#C397E6` |
| UAT InProgress | 12 | 4 | Testing | `#C9A4E8` |
| UAT Sign Off | 13 | 4 | Testing | `#D0B0E9` |
| Release Approval | 14 | 5 | Release Process | `#47ABA3` |
| Ready For Production | 15 | 5 | Release Process | `#36a49b` |
| Deployed | 16 | 6 | Deployed | `#20c769` |
| Completed | 17 | 7 | Completed | `#198754` |
| Testing Blocked | N/A | N/A | Exception | `#d33f49` |
| Deferred | N/A | N/A | Exception | `#868d95` |

---

## 23. Validation & Error Handling

* **API Failure Response**: Displays PrimeReact Toast notification with `severity: "error"`, `summary: "Failed"`, `detail: "Error : Check Log for more information"`.
* **Empty Data Response**: Displays centered Bootstrap Card with heading `"No Data Found in Project Breaches"`.
* **Permission Validation**: Permission flags (`hasPmDashAccess`, `hasBreachesAccess`, `can_export`) dynamically show/hide tabs, export controls, and actions.

---

## 24. State Management Summary

### `ProjectManagement.js` State
* `selectedPM`: Selected project type radio button (default: `"All Projects"`).
* `projectData`: Master array of Work Order objects returned from API.
* `FilterProjectData`: Filtered Work Order array after applying project type radio.
* `FilterProjectGridData`: Filtered Work Order array after applying search filter inputs.
* `CRData`: Master array of Change Request objects returned from API.
* `FilteredCRData`: Change Request array matching active `FilterProjectData` Work Orders.
* `statusGroupsList`: Array of 7 status group objects with computed `count` properties.
* `statusList`: Array of 17 status objects from `StaticData.json`.
* `selectedStatusSearch`: Selected item in status search dropdown.
* `IPM_number`: Search string for IPM project code.
* `ITDLSearch`: Search string for IT Delivery Lead.
* `ProductOwnerSearch`: Search string for Product Owner.
* `startDateSearch`: Selected start date bound in calendar filter.
* `endDateSearch`: Selected end date bound in calendar filter.
* `statusView`: Boolean toggle for table progress bar mode (Group vs 17 Stage).
* `executiveShow`: Boolean control for `ProjectExecutive` dialog modal.
* `showProject`: Boolean control for `ProjectInfo1` detail modal.
* `showProjects`: Boolean control for `Project` list modal.
* `showChartIcon`: Boolean toggle between status cards and status bar chart.
* `SelectedPage`: Current active tab (`"project_mngt"` or `"breaches"`).
* `isProjects`: Boolean controlling rendering of PM content.

---

## 25. Component Architecture

```text
ProjectManagement.js (Container Page)
├── Toast & PageLoader
├── Header Title & Timestamp
├── ButtonGroup (Tab Navigation Switcher)
├── ProjectBreaches.js (Rendered when SelectedPage === 'breaches')
│   ├── Card (Wrapper)
│   └── CountsCard (Card 11: Breaches, Card 12: Due Dates, Card 13: CR Exceptions)
└── PM Content (Rendered when SelectedPage === 'project_mngt')
    ├── Radio Buttons (All Projects & Depends_On Types)
    ├── PMCard Group Row (7 Status Group Cards + Testing Blocked + Deferred OR PrimeReact Bar Chart)
    ├── Search & Filter Panel (Status Dropdown, IPM Code, ITDL, PO, Start Date, End Date, Reset)
    ├── Main DataTable (Frozen Project Name, Description with More Dialog, Status ProgressBar)
    ├── CountsCard Grid (Cards 1 to 10)
    ├── Completed Projects Trends TabView (Monthly Chart, QuarterlyPMData, HalfYearlyPMData, AnnualPMData)
    ├── Dialog (Project Description text modal)
    ├── Dialog -> ProjectExecutive.js (Status Group drill-down grid)
    ├── Dialog -> Project.js (Status & Metric drill-down grid)
    └── Dialog -> ProjectInfo1.js (Single project details, timeline & circular progress bar)
```

---

## 26. Utilities, Helpers & Constants

* `StaticData.json`: Defines `PMStatusGroups`, `PMStatus`, and `ProjectList` datatable column definitions.
* `functions.js`: Helper functions `getFileUpdatedata` and `getFilesUpdatedata` wrapping service calls.
* `DateUtils.js`: Extracts monthly, quarterly, half-yearly, and annual project data slices.
* `OSSSystem`: Global registry providing `services`, `User` permissions, `TextEngine` localized strings, and `EventSystem`.

---

## 27. Export Functionality

* **Component**: `ExportTableComponent.js`.
* **Export Options**:
  * **Excel (`exportExcel`)**: Generates `.xlsx` spreadsheet using `XLSX.utils.json_to_sheet()` and `XLSX.writeFile()`. Sheet name capped at 31 characters.
  * **PDF (`exportPdf`)**: Generates PDF document using `jsPDF` and `jspdf-autotable`. Automatically sets orientation (`portrait` for <= 4 columns, `landscape` for > 4 columns). Includes page headers and footers ("Page X of Y").

---

## 28. User Interaction Flows

### Flow 1 — Open Project Monitoring Page
`User Navigates to Page → Mount Check Permissions → API Call (getProjectManagementData & getFilesUpdatedata) → Parse Wo_Id & Map Status → Populate State (projectData, CRData, statusGroupsList) → Render KPI Cards, Search Panel & Main DataTable`

### Flow 2 — Search & Filter Projects
`User Inputs Search Criteria (e.g., ITDL name or Date Range) → Presses Enter or Selects Calendar → Trigger onSearchProject() → Apply Multi-Filter Pipeline on FilterProjectData → Update FilterProjectGridData State → DataTable Re-renders Filtered Rows`

### Flow 3 — Drill-Down into Count Metric Card
`User Clicks Metric Row in CountsCard → Trigger onCountClick(rowData) → Open Dialog Modal (Project.js) → Pass ProjList / CRList → Render CustomDataTable with Export Excel/PDF Options`

### Flow 4 — Inspect Individual Project Timeline
`User Clicks Info Icon on Main Table Row → Open Dialog Modal (ProjectInfo1.js) → Calculate Timeline % & Overdue Days → Compute Lifecycle Stage Durations → Render Left/Right Tables, Circular Progress Bar & Lifecycle Chart`

---

## 29. Dependency & Integration Map

* **Core Libraries**: React (v18+), Bootstrap 5 (`react-bootstrap`).
* **UI Components**: PrimeReact (`DataTable`, `Column`, `Dialog`, `Calendar`, `Dropdown`, `InputText`, `RadioButton`, `Toast`, `TabView`, `TabPanel`, `Chart`, `ListBox`, `Badge`).
* **Icons**: `react-icons` (Ai, Bi, Bs, Fa, Fc, Gi, Im, Md, Si, Tb).
* **Export Libraries**: `jsPDF`, `jspdf-autotable`, `xlsx`.
* **Date Utilities**: `date-fns` (`format`).
* **Animation Utilities**: `react-flip-numbers`.

---

## 30. Source Code Reference Map

| Functionality | Source File | Component / Function | Key Logic / Lines |
|---|---|---|---|
| Master Container & Tab Switcher | `ProjectManagement.js` | `ProjectManagement` | [L53-L161](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L53-L161), [L636-L672](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L636-L672) |
| API Data Loading & Parsing | `ProjectManagement.js` | `loadProjectManagementData()`, `buildProjectData()` | [L1272-L1360](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L1272-L1360) |
| Multi-Criteria Search Filter | `ProjectManagement.js` | `onSearchProject()` | [L426-L485](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js#L426-L485) |
| Count Metric Cards & Breach Matrix | `CountsCard.js` | `CountsCard`, `loadComponentData()` | [L92-L795](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js#L92-L795) |
| Single Project Detail & Timeline | `ProjectInfo1.js` | `ProjectInfo1`, `componentDidMount()` | [L382-L491](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectInfo1.js#L382-L491) |
| High-Level Group Progress Bar | `ProjectStatusGroup.js` | `ProjectStatusGroup` | [L5-L38](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectStatusGroup.js#L5-L38) |
| Granular 17-Stage Progress Bar | `ProjectStatus.js` | `ProjectStatus` | [L5-L69](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectStatus.js#L5-L69) |
| Project Breaches Container | `ProjectBreaches.js` | `ProjectBreaches` | [L10-L182](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectBreaches.js#L10-L182) |
| Quarterly Trend Chart | `QuarterlyPMData.js` | `QuarterlyPMData` | [L40-L90](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/QuarterlyPMData.js#L40-L90) |
| Half-Yearly Trend Chart | `HalfYearlyPMData.js` | `HalfYearlyPMData` | [L40-L73](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/HalfYearlyPMData.js#L40-L73) |
| Annual Trend Chart | `AnnualPMData.js` | `AnnualPMData` | [L42-L85](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/Charts/AnnualPMData.js#L42-L85) |
| API Service Methods | `ProjectManagementService.js` | `getProjectManagementData()` | [L276-L278](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/Services/ProjectManagementService.js#L276-L278) |
| Excel & PDF Export | `ExportTableComponent.js` | `exportPdf()`, `exportExcel()` | [L13-L86](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/UtilComponents/ExportTableComponent.js#L13-L86) |

---

## 31. Hardcoded vs Dynamic Data

### Static / Hardcoded
* `StaticData.PMStatusGroups` (7 group definitions with IDs, names, target weights, hex colors).
* `StaticData.PMStatus` (17 status stage definitions with IDs, names, group IDs, hex colors).
* `StaticData.ProjectList` (Default datatable column header configurations).
* Default Card Configuration List (`this.cardData` in `ProjectManagement.js`).
* Monthly trend chart label array (`["January", "February", ...]`).

### Dynamic (Fetched from API)
* `result1`: Work Order records from `importworkorderstatusfile`.
* `result2`: Change Request records from `importworkorderstatusfile`.
* `lastupdated_wofile`, `lastupdated_crfile`: Timestamp strings from `getallfilesupdate`.

### Derived (Computed Client-Side)
* `StatusId` and `StatusGroup` mapped on each Work Order.
* Project Type Radio options (`uniqueProjectType`).
* Count Card groupings (Cards 1 through 10).
* All 13 Breach / Due Date / Exception rule calculation results (Cards 11, 12, 13).
* Timeline status percentage, overdue days, and circular progress offset (`ProjectInfo1.js`).
* Monthly, Quarterly, Half-Yearly, and Annual trend chart datasets.

---

## 32. Business Rules Summary

* `BR-001`: Access to Project Monitoring tab requires permission module `pmDash` with at least one active action permission.
* `BR-002`: Access to Project Breaches tab requires permission module `pmBr` with at least one active action permission.
* `BR-003`: Main Work Order status text must map to one of 17 defined SDLC status stages; unmapped statuses receive no `StatusId` or `StatusGroup`.
* `BR-004`: Projects with status `"Completed"` have fixed 100% progress and green color `#83AF9B`.
* `BR-005`: Projects exceeding their planned duration (`currentDate - Start_Date > Due_Date - Start_Date`) display red overdue alert text with exact day count delta.
* `BR-006`: Projects unclosed after 60 days from start date are flagged as breaches unless status is Deployed (16), Completed (17), or Deferred.
* `BR-007`: Work Orders remaining in testing status stages (IDs 8-12) for over 15 days from `SIT_Received_date` are flagged as testing breaches.
* `BR-008`: Work Orders missing planned development completion date within 45 days of due date are flagged as due date data breaches.
* `BR-009`: Change Requests where `End_Date` exceeds the parent Work Order `Due_Date` are flagged as CR schedule exceptions.
* `BR-010`: Change Requests missing effort (`Effort_in_MDs`), start date, or due date are flagged as CR governance data missing exceptions.

---

## 33. Validation Rules Summary

* `VAL-001`: `Wo_Id` parsing requires conversion to integer via `parseInt()`.
* `VAL-002`: Search date filter strings are converted to `YYYY-MM-DD` (`en-CA`) prior to string comparison against ISO `Start_Date` and `Due_Date`.
* `VAL-003`: End date calendar input enforces `minDate` boundary equal to selected start date search value.
* `VAL-004`: Comment date extraction uses regex `([A-Z][a-z]{2} \d{1,2}, \d{4})` to locate valid date substrings before computing staleness.
* `VAL-005`: Export to PDF/Excel requires `can_export` permission flag enabled on user's active role.

---

## 34. API Contract Summary

| Endpoint | Method | Response Key Fields | Error Handling | Primary Consumer |
|---|---|---|---|---|
| `/importworkorderstatusfile` | GET | `isSuccess` (bool), `result1` (Array<WO>), `result2` (Array<CR>) | Toast error notification | `ProjectManagement.js`, `ProjectBreaches.js` |
| `/getallfilesupdate` | GET | `isSuccess` (bool), `result.file_updates.wofile`, `result.file_updates.crfile` | Fallback to "Not Available" | `ProjectManagement.js` |
| `/getfileupdate` | POST | `isSuccess` (bool), `result.file_updates.wofile` | Fallback to "Not Available" | `ProjectBreaches.js` |

---

## 35. Known Code Issues & Edge Cases Audit

Inspection of the existing source code revealed several specific logic inconsistencies and potential runtime issues:

1. **Impossible Double Equals Condition in Card 11 Item 3 (`CountsCard.js:L244`)**:
   ```js
   return diffDays > BRDSSDForDays && obj.StatusId === 2 && obj.StatusId === 3;
   ```
   * *Issue*: `obj.StatusId` cannot simultaneously equal `2` and `3`. This condition always evaluates to `false`, causing the "Project in BRD/SSD Stage for more than 14 Days" count to remain 0.
   * *Impact*: BRD/SSD stage breaches are never detected.

2. **Impossible Double Equals Condition in Card 11 Item 4 (`CountsCard.js:L617`)**:
   ```js
   return CRdueDate < today && obj.Status === "Open" && obj.Status === "Development In Progress";
   ```
   * *Issue*: `obj.Status` cannot simultaneously equal `"Open"` and `"Development In Progress"`. This condition always evaluates to `false`.
   * *Impact*: Passed CR due dates are never counted.

3. **Accidental Assignment in Loop in Card 11 Item 5 (`CountsCard.js:L633`)**:
   ```js
   let projectStatusId = mySelf.props.data.filter((obj) => {
     return (obj.Wo_Id = x.Wo_Id && obj.StatusId >= 7);
   });
   ```
   * *Issue*: Uses single equals `=` instead of strict equality `===` (`obj.Wo_Id = ...`), mutating `obj.Wo_Id` during array filtering.

4. **Missing Check for `Status` String Case in Card 8 vs Card 9 (`CountsCard.js:L167`)**:
   * Card 8 uses `CR.End_Date`, Card 9 uses `WO.Due_Date`, Card 10 uses `WO.UAT_Actual_End_Date`. If `UAT_Actual_End_Date` is undefined/null, `new Date(undefined)` produces `Invalid Date` which fails comparison operators silently.

---

## 36. Final Completeness Verification Check

- [x] Every feature in Project Monitoring tab documented
- [x] Every feature in Project Breaches tab documented
- [x] Every visible UI element mapped
- [x] Every interactive element detailed
- [x] Every API endpoint and service documented
- [x] Every data field in Data Model mapped
- [x] Every calculation formula documented
- [x] Every business rule summarized
- [x] Every validation rule summarized
- [x] Every filter & dependency mapped
- [x] Search, sorting & pagination logic detailed
- [x] Expanded row / detail modal logic documented
- [x] Project Breaches calculation matrix created
- [x] Dashboard cards 1 to 13 detailed
- [x] Charts & visualizations documented
- [x] Date filters & timeline logic detailed
- [x] Status mapping tables (7 groups & 17 stages) created
- [x] Validation & error handling documented
- [x] State management variables listed
- [x] Component architecture tree mapped
- [x] Utilities / helpers / constants detailed
- [x] Export functionality (Excel & PDF) documented
- [x] User interaction flows detailed
- [x] Source code reference map created
- [x] Hardcoded vs dynamic data explicitly separated
- [x] Known code issues & edge cases documented without alteration
