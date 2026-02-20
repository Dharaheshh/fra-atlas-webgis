# 📘 PROJECT CONTEXT DOCUMENT

## Generative AI–Powered FRA Atlas & WebGIS Decision Support System

---

## 🧩 Project Overview

We are building a **Digital Intelligent Monitoring System** for governance under the Forest Rights Act (FRA).

The system will function as a **WebGIS-based decision support platform** that:

* Visualizes forest land claims spatially
* Detects land-use conflicts automatically
* Provides governance analytics
* Generates AI-powered compliance summaries

This project combines:

* GIS visualization
* Conflict detection logic
* Governance analytics
* Generative AI reporting

The goal is to improve transparency, reduce paperwork, and enable data-driven policy decisions.

---

# 🎯 Core Objectives

The system must achieve the following outcomes:

1. AI-generated compliance reports
2. Interactive WebGIS visualization
3. Predictive conflict detection
4. Policy decision support tools
5. Transparent governance analytics

---

# 🗺 1️⃣ Interactive WebGIS Visualization

The system must provide an interactive map interface that displays:

* Forest boundaries
* Individual land claims
* Approved claims
* Pending/rejected claims
* Protected zones

### Functional Requirements

* Zoom and pan functionality
* Layer toggling (Approved / Pending / Protected / Conflict)
* Clickable parcels with popup information
* Color-coded visualization:

  * Green → Approved
  * Yellow → Pending
  * Red → Conflict
  * Blue → Protected zone

This map will serve as the central intelligence layer of the system.

---

# ⚠ 2️⃣ Automated Conflict Detection

The system must automatically detect:

* Overlapping claims
* Claims inside protected forest zones
* Missing approval records
* Multiple claims on same parcel

### Conflict Detection Logic

For each region:

* Count total claims
* Count overlapping claims
* Count pending claims
* Detect protected zone intrusions

### Risk Score Formula

Risk Score =
( Pending Claims % × 50 ) + ( Conflict Overlap % × 50 )

Risk Classification:

* 0–40 → Low
* 41–70 → Moderate
* 71–100 → High

This serves as predictive conflict detection.

---

# 📊 3️⃣ Governance Analytics Dashboard

The system must provide analytics including:

* Total number of claims
* Approved claims %
* Pending claims %
* Conflict count
* Region-wise risk ranking
* Conflict heatmap

Visualization components:

* Pie charts
* Bar charts
* Risk ranking table
* Heatmap overlay

This fulfills transparent governance analytics.

---

# 🤖 4️⃣ Generative AI Compliance Engine (Using Gemini API)

The system must generate dynamic compliance summaries when a user clicks a region.

Input to Gemini:

* District name
* Total claims
* Pending claims
* Conflict count
* Risk level

Example Prompt:

"You are a governance compliance analyst under the Forest Rights Act. Generate a concise formal compliance summary using the following data: District: X, Total Claims: 18, Conflicts: 4, Pending: 3, Risk Level: Moderate. Include policy recommendations."

Example Output:

“This region contains 18 claims, of which 4 overlap protected forest areas and 3 remain pending verification. The conflict risk is categorized as Moderate. Administrative review and expedited verification are recommended.”

This reduces manual paperwork and improves clarity.

---

# 🏗 System Architecture

## Frontend (React)

Components:

* MapComponent (Leaflet)
* DashboardPanel
* RiskRankingTable
* ReportSection (AI Output)
* LayerTogglePanel

## Backend (Flask / FastAPI)

Modules:

* Data Loader (GeoJSON)
* Risk Engine
* Conflict Detector
* Analytics Aggregator
* Gemini Report Generator

## AI Layer

* Google Gemini API integration
* Prompt-based report generation
* Structured governance output

---

# 📁 Data Structure

Data will be stored in GeoJSON format.

Each feature contains:

* district
* village
* status (Approved / Pending / Rejected)
* area
* overlap (true/false)
* protected_zone (true/false)

Example structure:

{
"district": "Region A",
"village": "Village X",
"status": "Pending",
"overlap": true,
"protected_zone": false,
"area": 120
}

---

# 🔄 System Workflow

1. Load spatial data
2. Render map with layers
3. User selects district
4. Backend calculates:

   * Total claims
   * Conflict count
   * Pending count
   * Risk score
5. Display analytics dashboard
6. User clicks “Generate Compliance Report”
7. Gemini generates structured governance summary
8. Report displayed in UI

---

# 🏛 Policy Decision Support Features

* Region ranking by risk score
* Filter high-risk areas
* Automated recommendations
* Clear conflict statistics

This enables officers to prioritize interventions.

---

# 📌 Expected Final Output

The system should demonstrate:

✔ Real-time spatial visualization
✔ Automated conflict detection
✔ Governance analytics dashboard
✔ AI-generated compliance summaries
✔ Clear decision-support insights

---

# 🎬 Demo Narrative (For Presentation)

“This platform integrates spatial intelligence and generative AI to improve transparency and efficiency under the Forest Rights Act. It detects land conflicts automatically, ranks governance risk, and generates compliance summaries in seconds, significantly reducing manual administrative workload.”

---

# 🧠 Summary

This project is a WebGIS-based governance intelligence system that combines:

* Spatial data visualization
* Conflict detection logic
* Risk prediction
* Analytics dashboard
* Gemini-powered compliance reporting

It serves as a scalable digital decision-support platform for public administration.
