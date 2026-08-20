---
name: xlsx-document-analysis-skill
description: Skill for inspecting Excel XLSX documents, understanding workbook structure,sheets, columns, data types, formulas, and preparing files for analytics or ML workflows.
version: 1.0.0
---

# XLSX Document Analysis Skill

## Goal

Analyze Excel files to understand their structure before performing data analysis, reporting, or machine learning tasks.

---

# 1. Load XLSX File

Use pandas and openpyxl.

```python
import pandas as pd

excel = pd.ExcelFile(
    "file.xlsx"
)
````

---

# 2. Inspect Workbook Structure

List sheets:

```python
excel.sheet_names
```

Output example:

```
[
"Customers",
"Transactions",
"Products"
]
```

---

# 3. Analyze Each Sheet

Load sheet:

```python
df = pd.read_excel(
    "file.xlsx",
    sheet_name="Customers"
)
```

Inspect:

```python
df.head()

df.shape

df.info()

df.describe()
```

Check:

* number of rows
* number of columns
* column names
* data types
* empty fields

---

# 4. Column Structure Detection

Analyze columns:

```python
df.columns.tolist()
```

Identify:

* numeric columns
* text columns
* date columns
* identifier columns
* categorical columns

Example:

```text
customer_id -> identifier
age -> numeric
country -> categorical
created_date -> datetime
```

---

# 5. Data Quality Checks

Missing values:

```python
df.isnull().sum()
```

Duplicates:

```python
df.duplicated().sum()
```

Unique values:

```python
df.nunique()
```

Check:

* missing data
* duplicate rows
* inconsistent values
* unexpected formats

---

# 6. Formula and Excel Metadata Inspection

Use openpyxl for advanced inspection.

```python
from openpyxl import load_workbook

wb = load_workbook(
    "file.xlsx",
    data_only=False
)
```

Inspect:

* formulas
* merged cells
* hidden sheets
* workbook metadata

---

# 7. Generate Structure Summary

Final output should include:

```text
Workbook:
- File name
- Sheet count

Sheets:
- Sheet name
- Row count
- Column count

Columns:
- Column name
- Data type
- Missing count
- Example values

Quality:
- Missing values
- Duplicate records
- Potential issues
```

---

# LLM Instructions

When analyzing XLSX files:

1. First understand workbook structure.
2. List sheets before reading data.
3. Inspect columns and data types.
4. Identify relationships between sheets.
5. Detect data quality problems.
6. Prepare a clean summary before analytics.
7. Do not assume business meaning without column evidence.
8. Keep the original Excel structure unchanged.

---

```
```
