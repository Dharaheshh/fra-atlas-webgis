from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Configure Gemini AI
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

app = FastAPI(title="FRA WebGIS Decision Support System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "mock_claims.json")

@app.get("/api/claims")
def get_claims():
    """
    Returns the GeoJSON data for the land claims.
    """
    try:
         with open(DATA_FILE, "r") as f:
             data = json.load(f)
             return data
    except Exception as e:
         return {"error": str(e)}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/analytics")
def get_analytics():
    """
    Computes and returns regional risk analytics based on the spatial data.
    """
    try:
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
            features = data.get("features", [])

        # Overall Stats
        total_claims = len(features)
        approved_claims = 0
        pending_claims = 0
        conflict_claims = 0

        # District-level Stats
        districts_data = {}

        for feature in features:
            props = feature.get("properties", {})
            district = props.get("district", "Unknown")
            status = props.get("status", "Unknown")
            overlap = props.get("overlap", False)
            protected = props.get("protected_zone", False)

            # Global Counts
            if status == "Approved":
                approved_claims += 1
            elif status == "Pending":
                pending_claims += 1
            elif status == "Conflict" or overlap or protected:
                # We count any defined 'Conflict', or anything with overlap/protected zone as a conflict globally
                conflict_claims += 1
            
            # Initialize district if needed
            if district not in districts_data:
                districts_data[district] = {
                    "total": 0,
                    "pending": 0,
                    "conflicts": 0,
                    "approved": 0
                }
            
            # District Counts
            districts_data[district]["total"] += 1
            
            if status == "Pending":
                districts_data[district]["pending"] += 1
            elif status == "Approved":
                districts_data[district]["approved"] += 1
                
            if overlap or protected or status == "Conflict":
                districts_data[district]["conflicts"] += 1

        # Calculate Risk Scores per district
        district_rankings = []
        for name, stats in districts_data.items():
            total = stats["total"]
            if total == 0:
                continue
                
            pending_pct = (stats["pending"] / total) * 100
            conflict_pct = (stats["conflicts"] / total) * 100
            
            # Risk Score Formula -> (Pending Claims % x 50) + (Conflict Overlap % x 50) 
            # (Note: the brief formula is somewhat ambiguous about the scales, assuming 50% weights)
            risk_score = (pending_pct * 0.5) + (conflict_pct * 0.5)
            
            # Classification
            if risk_score <= 40:
                risk_level = "Low"
            elif risk_score <= 70:
                risk_level = "Moderate"
            else:
                risk_level = "High"
                
            district_rankings.append({
                "district": name,
                "total_claims": total,
                "pending": stats["pending"],
                "conflicts": stats["conflicts"],
                "risk_score": round(risk_score, 2),
                "risk_level": risk_level
            })
            
        # Sort by highest risk score first
        district_rankings.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "summary": {
                "total_claims": total_claims,
                "approved_claims": approved_claims,
                "pending_claims": pending_claims,
                "conflict_claims": conflict_claims,
                "approved_pct": round((approved_claims / total_claims * 100) if total_claims else 0, 1),
                "pending_pct": round((pending_claims / total_claims * 100) if total_claims else 0, 1),
            },
            "districts": district_rankings
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/api/report/{district}")
def generate_report(district: str):
    """
    Generates an AI compliance report for the specified district using the Gemini API.
    """
    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here":
        return {"error": "Google Gemini API Key is not configured in the backend .env file. Please add it to generate reports."}

    # First, we need to gather the data for this district by calling our own analytics function logic.
    # In a real app we'd abstract the logic, but for simplicity here we'll just call the function.
    analytics_response = get_analytics()
    
    if "error" in analytics_response:
        return {"error": f"Failed to gather analytics for report: {analytics_response['error']}"}
        
    districts_data = analytics_response.get("districts", [])
    
    target_data = next((d for d in districts_data if d["district"] == district), None)
    
    if not target_data:
        return {"error": f"No data found for district: {district}"}
        
    prompt = f"""
    You are an expert governance compliance analyst under the Forest Rights Act (FRA).
    Generate a concise formal compliance summary using the following regional data:
    
    District: {target_data['district']}
    Total Claims: {target_data['total_claims']}
    Conflicts (Overlaps/Protected Zones): {target_data['conflicts']}
    Pending Claims: {target_data['pending']}
    Calculated Risk Level: {target_data['risk_level']} (Score: {target_data['risk_score']})
    
    Please provide:
    1. A brief summary of the exact statistics above.
    2. The severity of the conflict risk.
    3. Actionable policy recommendations for administrative review.
    
    Keep the output professional, objective, and no longer than 2-3 paragraphs.
    """
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        return {
            "district": district,
            "reportText": response.text
        }
    except Exception as e:
        return {"error": f"AI Generation Failed: {str(e)}"}
