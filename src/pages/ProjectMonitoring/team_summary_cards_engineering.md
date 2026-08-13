# Team Summary Breakdown Cards — Legacy Engineering Specification

This document provides a comprehensive reverse-engineering analysis of the **Team Breakdown Cards** ("Count By" cards) in the legacy application (`ProjectManagement.js` and `CountsCard.js`). It documents data sources, field mappings, count definitions, name normalization rules, edge cases, and reconciliation guidance.

---

## 1. Components & File Map

The Team Breakdown Cards feature comprises the following files:

### Component Hierarchy
```text
ProjectManagement.js (Parent Container)
  └─ Team Breakdown Cards Grid
       └─ CountsCard (Card ID 1 through 7)
            └─ ListBox (Renders Name & Count Badge)
```

### Relevant Files & Roles
1. **[ProjectManagement.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/ProjectManagement.js)**
   - **Purpose**: Main parent page component for Project Monitoring.
   - **Role**: Defines the `cardData` array (card IDs 1 to 7 with their corresponding title labels) and passes `FilterProjectData` (`props.data`) and `FilteredCRData` (`props.crdata`) to each `CountsCard`.
2. **[CountsCard.js](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/Components/ProjectManagement/CountsCard.js)**
   - **Purpose**: Summary card component.
   - **Role**: Implements `myFunc(obj, prop)` which groups records by role field, calculates array lengths, and populates the PrimeReact `ListBox` UI with name labels and green count badges.
3. **[StaticData.json](file:///c:/git/toss/ARCO-RE-UI-TOSS/src/StaticData.json)**
   - **Purpose**: Static text definitions.
   - **Role**: Supplies title strings via `OSSSystem.TextEngine`.

---

## 2. API Specifications & Data Sources

- **Endpoint**: `${AppConfig.api.url}/pm/importworkorderstatusfile`
- **Method**: `GET`
- **Service Function**: `OSSSystem.services.projectManagementService.getProjectManagementData(afterResponse)`
- **Data Collections**:
  - `result1` (Work Orders): Used by Cards 1 through 5.
  - `result2` (Change Requests): Used by Cards 6 and 7.

---

## 3. Role → API Field Mapping

| Card ID | Card Title Label | Target Business Role | Target Payload Collection | Source API Field | Count Unit |
|---|---|---|---|---|---|
| **1** | Count by IT Delivery Lead | IT Delivery Lead | `result1` (Work Orders) | `IT_Delivery_Lead` | Work Order / Project Records |
| **2** | Count by Product Owner | Product Owner | `result1` (Work Orders) | `Product_Owner` | Work Order / Project Records |
| **3** | Count by Backup ITDL | Backup ITDL | `result1` (Work Orders) | `Backup_IT_Delivery_Lead` | Work Order / Project Records |
| **4** | Count by SIT Lead | SIT Lead | Work Orders (`result1`) | `SIT_Lead` | Work Order / Project Records |
| **5** | Count by UAT Lead | UAT Lead | Work Orders (`result1`) | `UAT_Lead` | Work Order / Project Records |
| **6** | Count by Developer | Developer | `result2` (Change Requests) | `Assigned_Developer` | Change Request Records |
| **7** | Count by Additional Developer | Additional Developer | `result2` (Change Requests) | `Additional_Developers` | Change Request Records |

---

## 4. What Is Actively Being Counted? (Record vs Unique Project Count)

### 1. Cards 1 to 5 (ITDL, PO, Backup ITDL, SIT Lead, UAT Lead)
- **Target Array**: `result1` (Work Orders).
- **Count Formula**: `groupedObject[name]?.length`
- **What it Represents**: Count of **Work Order (Project) records** in `result1` that match the exact string key.
- **Deduplication**: **None.** If `result1` contains duplicate Work Order objects, every occurrence is counted.

### 2. Cards 6 & 7 (Developer & Additional Developer)
- **Target Array**: `result2` (Change Requests).
- **Count Formula**: `groupedObject[name]?.length`
- **What it Represents**: Count of **Change Request (CR) records** in `result2` matching the exact string key, **NOT Work Orders/Projects**.
- **Deduplication**: **None.** Every matching CR record is counted.

---

## 5. Common Base Filters & Filter Sequence

The data flow and filtering sequence before counting is as follows:

```text
API Response (result1 & result2)
      ↓
Project Type Radio Filter (e.g., "All Projects" or specific Depends_On type)
      ↓
FilterProjectData (WO Array) & FilteredCRData (CR Array) passed to CountsCard
      ↓
CountsCard.myFunc(data, prop) groups array using Array.prototype.reduce
      ↓
Object.keys(groupedObject) iterated to build [{ name, count, ProjList/CRList }]
      ↓
Rendered in PrimeReact ListBox
```

### Key Filter Notes
1. **Status Filter**: **No project status filters are applied.** Projects in all stages (`Inception`, `Building`, `Testing`, `Deployed`, `Completed`, `Deferred`) are included.
2. **Search Filter**: Top search bar filters do **not** affect `CountsCard` input data.

---

## 6. Legacy Name Normalization & Edge Case Rules

The legacy `myFunc` function uses standard JavaScript object property assignment without string manipulation:

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

### Legacy Behavior Matrix

| Input Condition | Raw API Value Example | Legacy Key Created | Legacy Result | Recommended New App Rule |
|---|---|---|---|---|
| **Undefined Field** | `item.IT_Delivery_Lead` missing | `"undefined"` | Renders row labeled `"undefined"` | Treat as `"unassigned"` |
| **Null Field** | `null` | `"null"` | Renders row labeled `"null"` | Treat as `"unassigned"` |
| **Empty String** | `""` | `""` | Renders row with blank label | Treat as `"unassigned"` |
| **Leading/Trailing Spaces** | `" John "` | `" John "` | Creates separate key from `"John"` | Trim whitespace via `.trim()` |
| **Multiple Spaces** | `"John  Doe"` | `"John  Doe"` | Creates separate key from `"John Doe"` | Normalize inner spaces |
| **Case Variants** | `"JOHN"`, `"John"` | `"JOHN"`, `"John"` | Creates two separate keys | Case-insensitive matching/display |
| **Comma-Separated Names** | `"Dev A, Dev B"` | `"Dev A, Dev B"` | Groups under combined string | Split by `,` or `/` if individual developer tracking is desired |

---

## 7. Reconciled Calculation Formulas for the New Application

To achieve mathematical correctness while adhering to business expectations:

### 1. ITDL / PO / Backup ITDL / SIT Lead / UAT Lead Cards (Cards 1–5)
- Target: Work Orders / Projects.
- Formula:
  $$\text{Count}(\text{Role}, \text{Person}) = \left| \{ p \in \text{WorkOrders} \mid \text{Trim}(\text{Normalized}(p[\text{RoleField}])) = \text{Person} \} \right|$$
- Filter out duplicate Work Order IDs if present in raw payload.

### 2. Developer & Additional Developer Cards (Cards 6–7)
- Target: Change Requests (CRs).
- Formula:
  $$\text{Count}(\text{Developer}) = \left| \{ cr \in \text{ChangeRequests} \mid \text{Trim}(\text{Normalized}(cr[\text{DevField}])) = \text{Developer} \} \right|$$

---

## 8. Source Code Evidence

### Evidence 1: Card Definitions
- **File**: `ProjectManagement.js`
- **Lines**: 123–147
- **Code**:
  ```javascript
    this.cardData = [
      { cardid: 1, title: OSSSystem.TextEngine.CountByITDeliveryLead, color: "greenyellow" },
      { cardid: 2, title: "Count BY Product Owner" },
      { cardid: 3, title: OSSSystem.TextEngine.CountByBackupITDL },
      { cardid: 4, title: OSSSystem.TextEngine.CountBySITLead },
      { cardid: 5, title: OSSSystem.TextEngine.CountByUATLead },
      { cardid: 6, title: OSSSystem.TextEngine.CountByDeveloper },
      { cardid: 7, title: OSSSystem.TextEngine.CountByAdditionalDeveloper },
    ];
  ```

### Evidence 2: Grouping & Data Source Switch
- **File**: `CountsCard.js`
- **Lines**: 97–148
- **Code**:
  ```javascript
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

### Evidence 3: Grouping Implementation
- **File**: `CountsCard.js`
- **Lines**: 80–91
- **Code**:
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

---

## 9. End-to-End Execution Sequence

1. User views the **Project Monitoring** dashboard.
2. `ProjectManagement.js` fetches project payload from `/pm/importworkorderstatusfile`.
3. Sets `FilterProjectData` (`result1`) and `FilteredCRData` (`result2`).
4. Instantiates 7 `<CountsCard>` components passing `data={FilterProjectData}` and `crdata={FilteredCRData}`.
5. Each `CountsCard` runs `loadComponentData()`:
   - Evaluates `switch(cardid)`.
   - Calls `myFunc(data, field)` for cards 1–5, grouping Work Orders.
   - Calls `myFunc(crdata, field)` for cards 6–7, grouping Change Requests.
6. Maps `groupedObject` keys to `groupedArray` containing `{ name, count, ProjList/CRList }`.
7. Renders name labels and green count badges inside PrimeReact `ListBox`.
