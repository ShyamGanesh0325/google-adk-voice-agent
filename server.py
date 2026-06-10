import asyncio
import json
from typing import Any, Dict, Optional
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Import the database functions from db.py
from db import (
    retrieve_patient_data,
    check_active_appointments,
    search_patients_by_name,
    schedule_appointment,
    retrieve_patient_medcial_record
)

# Create the MCP server
server = Server("clinical-assistant-db")

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="retrieve_patient_data",
            description="Retrieve comprehensive patient information by patient ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient ID to retrieve data for"
                    }
                },
                "required": ["patient_id"]
            }
        ),
        Tool(
            name="retrieve_patient_medcial_record",
            description="Retrieve comprehensive patient medical records by patient ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient ID to retrieve data for"
                    }
                },
                "required": ["patient_id"]
            }
        ),
        Tool(
            name="search_patients_by_name",
            description="Search for patients by name (partial match supported)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Patient name or partial name to search for"
                    }
                },
                "required": ["name"]
            }
        ),
        Tool(
            name="check_active_appointments",
            description="Check active appointments for a patient or all patients within specified days",
            inputSchema={
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "Optional patient ID to filter appointments for specific patient"
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="schedule_appointment",
            description="Schedule a new appointment for a patient",
            inputSchema={
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "Patient ID to schedule appointment for"
                    },
                    "appointment_date": {
                        "type": "string",
                        "description": "Appointment date in YYYY-MM-DD format"
                    },
                    "appointment_time": {
                        "type": "string",
                        "description": "Appointment time in HH:MM format"
                    }
                },
                "required": ["patient_id", "appointment_date", "appointment_time"]
            }
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "retrieve_patient_data":
            result = retrieve_patient_data(arguments["patient_id"])
        elif name == "search_patients_by_name":
            result = search_patients_by_name(arguments["name"])
        elif name == "check_active_appointments":
            patient_id = arguments.get("patient_id")
            result = check_active_appointments(patient_id)
        elif name == "retrieve_patient_medcial_record":
            result = retrieve_patient_medcial_record(arguments["patient_id"])
        elif name == "schedule_appointment":
            result = schedule_appointment(
                arguments["patient_id"],
                arguments["appointment_date"],
                arguments["appointment_time"]
            )
        else:
            raise ValueError(f"Unknown tool: {name}")
        
        # Format the result as JSON string for better readability
        result_text = json.dumps(result, indent=2, ensure_ascii=False)
        
        return [TextContent(type="text", text=result_text)]
    
    except Exception as e:
        error_result = {
            "status": "error",
            "message": f"Error executing {name}: {str(e)}"
        }
        return [TextContent(type="text", text=json.dumps(error_result, indent=2))]

async def main():
    """Main entry point for the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())