import sqlite3
import datetime
from typing import Dict, Optional, List
import uuid

class PatientDatabase:
    def __init__(self, db_path="clinical_assistant.db"):
        self.db_path = db_path
        self.init_database()
        self.populate_sample_data()

    def init_database(self):
        """Initialize a single-table schema for patient records."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create unified patient_records table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS patient_records (
                patient_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                date_of_birth DATE,
                medical_history TEXT,
                allergies TEXT,
                symptoms TEXT,
                treatments TEXT,
                diagnosis TEXT,
                prescribed_medications TEXT,
                appointments TEXT,
                last_date_visited DATE
            )
        ''')

        conn.commit()
        conn.close()

    def populate_sample_data(self):
        """Populate the unified table with sample data."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Skip if already populated
        cursor.execute("SELECT COUNT(*) FROM patient_records")
        if (cursor.fetchone() or [0])[0] > 0:
            conn.close()
            return

        # Source sample data (adapted from legacy schema)
        patients_data = [
            ('P1', 'John Doe', '1980-05-15', 'Hypertension, Type II Diabetes', 'Penicillin'),
            ('P2', 'Mary Smith', '1990-11-20', 'Asthma', 'None'),
            ('P3', 'Robert Brown', '1975-02-10', 'High Cholesterol, Arthritis', 'Seafood'),
            ('P4', 'Emma Wilson', '1985-07-30', 'Migraine, Anxiety', 'Sulfa drugs'),
            ('P5', 'Michael Johnson', '1992-12-05', 'None', 'None'),
        ]

        appointments_data = [
            ('APT-1001', 'P1', 'Dr. Alice Johnson', '2025-11-29', '14:00', 'scheduled',
             'Routine Checkup', 'Patient reports feeling well'),
            ('APT-1002', 'P2', 'Dr. Bob Martinez', '2025-11-32', '10:30', 'scheduled',
             'Asthma Follow-up', 'Check inhaler technique'),
            ('APT-1003', 'P3', 'Dr. Charlie Brown', '2025-12-01', '16:00', 'scheduled',
             'Cholesterol Management', 'Review lab results'),
            ('APT-1004', 'P1', 'Dr. Alice Johnson', '2025-11-30', '09:00', 'scheduled',
             'Diabetes Management', 'A1C test due'),
            ('APT-1005', 'P4', 'Dr. Sarah Davis', '2025-11-29', '15:15', 'scheduled',
             'Migraine Consultation', 'New treatment options'),
        ]

        medical_records_data = [
            ('REC-2001', 'P1', '2025-08-01', 'Headache, Fatigue', 'Hypertension',
             'Adjusted medication dosage', 'Lisinopril 10mg daily', 'Monitor blood pressure weekly'),
            ('REC-2002', 'P2', '2025-07-15', 'Shortness of breath, Wheezing', 'Asthma exacerbation',
             'Prescribed rescue inhaler', 'Albuterol Inhaler 2 puffs PRN', 'Follow up in 2 weeks'),
            ('REC-2003', 'P3', '2025-07-20', 'Joint pain, Stiffness', 'Arthritis flare-up',
             'Anti-inflammatory medication', 'Ibuprofen 400mg TID', 'Physical therapy referral'),
            ('REC-2004', 'P4', '2025-08-10', 'Severe headache, Nausea', 'Migraine',
             'Prescribed migraine medication', 'Sumatriptan 50mg PRN', 'Avoid known triggers'),
            ('REC-2005', 'P5', '2025-08-25', 'Annual physical exam', 'Healthy',
             'Continue current lifestyle', 'Multivitamin daily', 'Return in 1 year'),
        ]

        # Build appointment map (patient_id -> list of "YYYY-MM-DD HH:MM")
        appt_map: Dict[str, List[str]] = {}
        for _, pid, _, date, time, status, *_ in appointments_data:
            if status != 'scheduled':
                continue
            appt_map.setdefault(pid, []).append(f"{date} {time}")

        # Build latest medical record map per patient
        rec_map: Dict[str, Dict[str, Optional[str]]] = {}
        for _, pid, visit_date, symptoms, diagnosis, treatment, meds, _ in medical_records_data:
            current = rec_map.get(pid)
            if not current or visit_date > current["last_date_visited"]:
                rec_map[pid] = {
                    "last_date_visited": visit_date,
                    "symptoms": symptoms,
                    "diagnosis": diagnosis,
                    "treatments": treatment,
                    "prescribed_medications": meds,
                }

        rows = []
        for pid, name, dob, med_hist, allergies in patients_data:
            rec = rec_map.get(pid, {
                "last_date_visited": None,
                "symptoms": "",
                "diagnosis": "",
                "treatments": "",
                "prescribed_medications": "",
            })
            appts = ",".join(sorted(appt_map.get(pid, [])))
            rows.append((
                pid, name, dob, med_hist, allergies,
                rec["symptoms"], rec["treatments"], rec["diagnosis"],
                rec["prescribed_medications"], appts, rec["last_date_visited"]
            ))

        cursor.executemany('''
            INSERT OR IGNORE INTO patient_records (
                patient_id, name, date_of_birth, medical_history, allergies,
                symptoms, treatments, diagnosis, prescribed_medications,
                appointments, last_date_visited
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', rows)

        conn.commit()
        conn.close()

# Initialize database with sample data
db = PatientDatabase()

# Clinical Assistant Tools (single-table versions)
def retrieve_patient_data(patient_id: str) -> Dict:
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT patient_id, name, date_of_birth, medical_history,
                   appointments, last_date_visited
            FROM patient_records
            WHERE patient_id = ?
        """, (patient_id,))
        row = cursor.fetchone()
        if not row:
            return {"status": "error", "message": "Patient not found"}
        keys = [
            "patient_id", "name", "date_of_birth", "medical_history", "allergies",
            "symptoms", "treatments", "diagnosis", "prescribed_medications",
            "appointments", "last_date_visited"
        ]
        record = dict(zip(keys, row))
        return {"status": "success", "patient_record": record}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def check_active_appointments(patient_id: Optional[str] = None) -> Dict:
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    try:
        if patient_id:
            cursor.execute("SELECT patient_id, name, appointments FROM patient_records WHERE patient_id = ?", (patient_id,))
        else:
            cursor.execute("SELECT patient_id, name, appointments FROM patient_records")
        results = []
        for pid, name, appts_str in cursor.fetchall():
            if not appts_str:
                continue
            for slot in [s.strip() for s in appts_str.split(",") if s.strip()]:
                results.append({"patient_id": pid, "name": name, "appointment": slot})
        results.sort(key=lambda x: x["appointment"])
        return {"status": "success", "active_appointments": results, "count": len(results)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


def retrieve_patient_medcial_record(patient_id: str) -> Dict:
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT patient_id, name, medical_history, allergies,
                   symptoms, treatments, diagnosis, prescribed_medications
            FROM patient_records
            WHERE patient_id = ?
        """, (patient_id,))
        row = cursor.fetchone()
        if not row:
            return {"status": "error", "message": "Patient not found"}
        keys = [
            "patient_id", "name", "medical_history", "allergies",
            "symptoms", "treatments", "diagnosis", "prescribed_medications"
        ]
        record = dict(zip(keys, row))
        return {"status": "success", "patient_record": record}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def schedule_appointment(patient_id: str, appointment_date: str,appointment_time: str) -> Dict:
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT appointments, name FROM patient_records WHERE patient_id = ?", (patient_id,))
        row = cursor.fetchone()
        if not row:
            return {"status": "error", "message": "Patient not found"}
        current, name = row
        new_slot = f"{appointment_date} {appointment_time}"
        slots = [s.strip() for s in (current or "").split(",") if s.strip()]
        slots.append(new_slot)
        slots = sorted(set(slots))
        cursor.execute("UPDATE patient_records SET appointments = ? WHERE patient_id = ?", (",".join(slots), patient_id))
        conn.commit()
        return {
            "status": "success",
            "message": f"Appointment scheduled for {new_slot} for {name}"
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()
        

def search_patients_by_name(name: str) -> Dict:
    """Search patients by name in the unified table."""
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT patient_id, name, date_of_birth
            FROM patient_records
            WHERE name LIKE ?
        """, (f"%{name}%",))
        patients = cursor.fetchall()
        return {"status": "success", "patients": patients, "count": len(patients)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


